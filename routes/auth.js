const bcrypt = require("bcryptjs");
const express = require("express");
const jwt = require("jsonwebtoken");
const { 
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  RespondToAuthChallengeCommand,
  InitiateAuthCommand,
  AdminAddUserToGroupCommand // ADDED THIS FOR USER GROUPS
} = require("@aws-sdk/client-cognito-identity-provider");
const jwksClient = require("jwks-rsa");

const router = express.Router();

// ======= Cognito setup =======
const REGION = "ap-southeast-2";
const CLIENT_ID = "3c6fbkdcrr96tgfhja3qg5p35d";
const CLIENT_SECRET = "lv5vesb7me82ooqu7ucu1d8squbf630nc70ph0v9o4q7uptnu1a"; // from AWS console
const USER_POOL_ID = "ap-southeast-2_mBr78YUYo"; // for JWT verification

const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

// JWKS client for verifying Cognito JWT
const client = jwksClient({
  jwksUri: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

// ======= Middleware for JWT-protected routes =======
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token" });
  const token = authHeader.split(" ")[1];

  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(
      Buffer.from(base64, "base64").toString("utf-8")
    );

    req.user = decoded["cognito:username"];
    req.groups = decoded["cognito:groups"] || [];
    next();
  } catch (err) {
    console.error("Authenticate error:", err);
    return res.status(401).json({ error: "Invalid token" });
  }
}; 

// ======= Middleware to require admin =======
const requireAdmin = (req, res, next) => {
  if (!req.groups || !req.groups.includes("Admin")) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// ======= Endpoints =======

// Sign-up
router.post("/signup", async (req, res) => {
  const { username, password, email } = req.body;

  try {
    const command = new SignUpCommand({
      ClientId: CLIENT_ID,
      SecretHash: getSecretHash(username), 
      Username: username,
      Password: password,
      UserAttributes: [{ Name: "email", Value: email }]
    });

    const response = await cognitoClient.send(command);
    res.json({ message: "Sign-up successful, check your email for confirmation", data: response });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// Confirm sign-up
router.post("/confirm", async (req, res) => {
  const { username, confirmationCode } = req.body;
  try {
    const command = new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: username,
      ConfirmationCode: confirmationCode,
      SecretHash: getSecretHash(username)
    });
    await cognitoClient.send(command);
    res.json({ message: "User confirmed successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const command = new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
        SECRET_HASH: getSecretHash(username)
      }
    });

    const response = await cognitoClient.send(command);

    // If MFA or confirmation required
    if (response.ChallengeName) {
      return res.json({
        challengeName: response.ChallengeName,
        session: response.Session,  // needed for confirm-login
        message: "Confirmation code required"
      });
    }

    // Normal login
    res.json({
      IdToken: response.AuthenticationResult.IdToken,
      message: "Login successful"
    });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// confirmation
router.post("/confirm-login", async (req, res) => {
  const { username, confirmationCode, session } = req.body;

  try {
const command = new RespondToAuthChallengeCommand({
      ClientId: CLIENT_ID,
      ChallengeName: "EMAIL_OTP",   // force email OTP challenge
      Session: session,
      ChallengeResponses: {
        USERNAME: username,
        EMAIL_OTP_CODE: confirmationCode,  // required for email MFA
        SECRET_HASH: getSecretHash(username)
      }
    });

    const response = await cognitoClient.send(command);

    res.json({
      IdToken: response.AuthenticationResult.IdToken,
      message: "Login successful"
    });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Example protected route
router.get("/profile", authenticate, (req, res) => {
  res.json({ message: `Hello ${req.user}, this is your profile` });
});

const crypto = require("crypto");

function getSecretHash(username) {
  const clientId = CLIENT_ID;        // Cognito App Client ID
  const clientSecret = CLIENT_SECRET; //  Cognito App Client Secret
  const hmac = crypto.createHmac("sha256", clientSecret);
  hmac.update(username + clientId);
  return hmac.digest("base64");
}

module.exports = router;
module.exports.authenticate = authenticate;
module.exports.requireAdmin = requireAdmin;
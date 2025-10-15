const jwt = require("jsonwebtoken");
const SECRET_KEY = "supersecret"; // Should use ENV variable

function authenticate(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Invalid token format" });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded.username;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = { authenticate };

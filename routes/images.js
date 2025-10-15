// routes/images.js
const express = require("express");
const { authenticate, requireAdmin } = require("./auth");
const {
  DynamoDBClient
} = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  DeleteCommand
} = require("@aws-sdk/lib-dynamodb");
const {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { getParameter } = require("../utils/parameters");
const { getUserImages, updateUserCache } = require("../utils/cache");

const router = express.Router();
const region = "ap-southeast-2";

// AWS clients
const ddbClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});
const s3Client = new S3Client({ region });

// Parameters (loaded once at startup)
let tableName;
let bucketName;

(async () => {
  try {
    tableName = await getParameter("/bma2/dynamodb_table");
    bucketName = await getParameter("/bma2/s3_bucket");
    console.log("Loaded from Parameter Store:", { tableName, bucketName });
  } catch (err) {
    console.error("Failed to load parameters from SSM:", err);
  }
})();

// ------------------------------
// GET /images - list user images
// ------------------------------
router.get("/", authenticate, async (req, res) => {
  try {
    if (!tableName || !bucketName) {
      return res.status(500).json({ error: "App configuration not loaded yet" });
    }

    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "#u = :user",
      ExpressionAttributeNames: { "#u": "username" },
      ExpressionAttributeValues: { ":user": req.user || "unknown-user" },
    });

    const data = await docClient.send(command);

    const userImages = await Promise.all(
      (data.Items || []).map(async (item) => {
        let presignedUrl = null;

        if (item.s3Key) {
          try {
            const getCmd = new GetObjectCommand({
              Bucket: bucketName,
              Key: item.s3Key,
            });
            presignedUrl = await getSignedUrl(s3Client, getCmd, { expiresIn: 300 }); // 5 min
          } catch (err) {
            console.error("Presign error:", err);
          }
        }

        return {
          id: item.id,
          type: item.type,
          filter: item.filter,
          uploadedAt: item.uploadedAt,
          processedAt: item.processedAt,
          s3Url: presignedUrl,
        };
      })
    );

    res.json({ images: userImages });
  } catch (err) {
    console.error("Failed to fetch images:", err);
    res.status(500).json({ error: "Failed to fetch images" });
  }
});

// ------------------------------
// DELETE /images/:id (admin only)
// ------------------------------
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  const imageId = req.params.id;
  try {
    if (!tableName || !bucketName) {
      return res.status(500).json({ error: "App configuration not loaded yet" });
    }

    // Get item
    const getItem = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: { id: imageId, username: req.user },
      })
    );

    if (!getItem.Item) {
      return res.status(404).json({ error: "Image not found" });
    }

    const s3Key = getItem.Item.s3Key;

    // Delete from S3
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
      })
    );

    // Delete from DynamoDB
    await docClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { id: imageId, username: req.user },
      })
    );

    res.json({ success: true, message: "Image deleted" });
  } catch (err) {
    console.error("Delete failed:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// ------------------------------
// POST /images/upload
// ------------------------------
router.post("/upload", authenticate, async (req, res) => {
  try {
    if (!tableName || !bucketName) {
      return res.status(500).json({ error: "App configuration not loaded yet" });
    }

    // TODO: implement actual upload logic (S3 upload + DynamoDB save)
    const uploadedItem = { id: "temp-id", username: req.user, uploadedAt: Date.now() };

    // Refresh cache
    const userId = req.user || "unknown-user";
    const updatedImages = await getUserImages(userId);
    await updateUserCache(userId, updatedImages);

    res.json({ success: true, item: uploadedItem });
  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

module.exports = router;

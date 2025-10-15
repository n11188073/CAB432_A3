const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { authenticate } = require("./auth");
const { uploadToS3, getDownloadPresignedUrl } = require("../utils/s3");
const { putItem } = require("../utils/dynamodb");
const { getParameter } = require("../utils/parameters");

const router = express.Router();

// Ensure tmp upload dir exists
const uploadDir = path.join(__dirname, "../data/uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Cache Parameter Store values
let bucketName, tableName;
(async () => {
  bucketName = await getParameter("/bma2/s3_bucket");
  tableName = await getParameter("/bma2/dynamodb_table");
})();

// POST /upload
router.post("/", authenticate, upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const localPath = path.join(uploadDir, req.file.filename);
  const s3Key = `uploads/${req.file.filename}`;

  try {
    await uploadToS3(localPath, s3Key, bucketName);
    const s3Url = await getDownloadPresignedUrl(s3Key, bucketName);

    const item = {
      username: req.user,
      id: req.file.filename,
      owner: req.user,
      type: "uploaded",
      filter: null,
      s3Key,
      s3Url,
      localUrl: null,
      processedAt: null,
      createdAt: new Date().toISOString(),
      uploadedAt: new Date().toISOString(),
    };

    await putItem(item, tableName);

    res.json({ message: "Upload successful", item });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
});

module.exports = router;

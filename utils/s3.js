// utils/s3.js
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const fs = require("fs");
const path = require("path");

const BUCKET = "b-m-a2";
const s3 = new S3Client({ region: "ap-southeast-2" });

// Upload a file to S3 using Upload (handles streams of unknown length)
async function uploadToS3(localPath, key) {
  const fileStream = fs.createReadStream(localPath);

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: fileStream,
      ContentType: getContentType(localPath),
    },
  });

  await upload.done();
  console.log(`Uploaded ${key} to bucket ${BUCKET}`);
}

// Get a pre-signed URL for downloading a file
async function getDownloadPresignedUrl(key) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  return await getSignedUrl(s3, command, { expiresIn: 3600 });
}

// Guess MIME type from file extension
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

module.exports = { uploadToS3, getDownloadPresignedUrl };

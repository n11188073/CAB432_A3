// cache.js
const Memcached = require("memcached");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const util = require("node:util");

// ----------------------
// Memcached Setup
// ----------------------
const MEMCACHED_ENDPOINT = "filterimga2.km2jzi.cfg.apse2.cache.amazonaws.com:11211";
const memcached = new Memcached(MEMCACHED_ENDPOINT);

memcached.connect(MEMCACHED_ENDPOINT, (err) => {
  if (err) console.error("Memcached connection error:", err);
  else console.log("Memcached connected!");
});

const memcachedGet = util.promisify(memcached.get.bind(memcached));
const memcachedSet = util.promisify(memcached.set.bind(memcached));

// ----------------------
// AWS Setup
// ----------------------
const region = "ap-southeast-2";
const tableName = "b_m_a2";
const bucketName = "b-m-a2";

const ddbClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({ region });

// ----------------------
// Fetch images from DynamoDB
// ----------------------
async function fetchImagesFromDB(userId) {
  try {
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "#u = :user",
      ExpressionAttributeNames: { "#u": "username" },
      ExpressionAttributeValues: { ":user": userId },
    });

    const data = await docClient.send(command);

        const images = await Promise.all(
      (data.Items || []).map(async (item) => {
        let s3Url = null;
        if (item.s3Key) {
          try {
            const getCmd = new GetObjectCommand({
              Bucket: bucketName,
              Key: item.s3Key,
            });
            s3Url = await getSignedUrl(s3Client, getCmd, { expiresIn: 300 });
          } catch (err) {
            console.error("Presign error for user", userId, err);
          }
        }

        return {
          id: item.id,
          type: item.type,
          filter: item.filter,
          uploadedAt: item.uploadedAt,
          processedAt: item.processedAt,
          s3Url,
        };
      })
    );

    return images;
  } catch (err) {
    console.error("DynamoDB fetch error for user", userId, err);
    return [];
  }
}

// ----------------------
// Get user images (with cache)
// ----------------------
async function getUserImages(userId) {
  const cacheKey = `userImages:${userId}`;

  try {
    const cachedData = await memcachedGet(cacheKey);

    if (cachedData) {
     // console.log(`Cache hit (cloud) for user: ${userId}`);
     // return JSON.parse(cachedData);
const images = JSON.parse(cachedData);
  console.log(`Cache hit (cloud) for user: ${userId} — Returned ${images.length} images`);
  return images;
    }

    console.log(`Cache miss (cloud) for user: ${userId}`);
    const freshImages = await fetchImagesFromDB(userId);
console.log(`Fetched ${freshImages.length} images from DB for user: ${userId}`);
    try {
      await memcachedSet(cacheKey, JSON.stringify(freshImages), 300); // 5 min TTL
    } catch (err) {
      console.error("Cache set error for user", userId, err);
    }

    return freshImages;
  } catch (err) {
    console.error("Cache get error for user", userId, err);
    return [];
  }
}

// ----------------------
// Update user cache after upload
// ----------------------
async function updateUserCache(userId, images) {
  const cacheKey = `userImages:${userId}`;
  try {
    await memcachedSet(cacheKey, JSON.stringify(images), 300); // 5 min TTL
    console.log(`Cache updated for user: ${userId}`);
  } catch (err) {
    console.error("Cache update error for user", userId, err);

  }
}

module.exports = { getUserImages, updateUserCache };
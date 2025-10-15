// utils/dynamodb.js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

// Create low-level DynamoDB client
const client = new DynamoDBClient({ region: "ap-southeast-2" });

// Create Document client for easier JS object handling
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true, // avoids errors with undefined fields
  },
});

// DynamoDB table name
const tableName = "b_m_a2";

/**
 * Save metadata into DynamoDB
 * @param {Object} item - The item to insert (must include partition key: username and sort key: id)
 */
async function putItem(item) {
  try {
    // Validate required keys
    if (!item["username"] || !item.id) {
      throw new Error("Item must include 'username' and 'id'");
    }

    const command = new PutCommand({
      TableName: tableName,
      Item: {
        ...item,                          // Include all provided fields
        uploadedAt: new Date().toISOString(), // Automatically add upload timestamp
      },
    });

    await docClient.send(command);
    console.log("DynamoDB item stored:", item);
  } catch (err) {
    console.error("DynamoDB error:", err);
    throw err;
  }
}

module.exports = { putItem };

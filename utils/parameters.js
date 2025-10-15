// utils/parameters.js
require('dotenv').config(); // loads .env from project root
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

const region = process.env.AWS_REGION || 'ap-southeast-2';
const ssmClient = new SSMClient({ region });

async function getParameter(name, fallback) {
  try {
    const response = await ssmClient.send(
      new GetParameterCommand({ Name: name })
    );
    if (response.Parameter && response.Parameter.Value) {
      console.log(`Loaded from Parameter Store: ${name}`);
      return response.Parameter.Value;
    }
  } catch (err) {
    console.warn(`SSM getParameter failed for ${name}, using .env fallback: ${err.name}`);
  }

  if (fallback) return fallback;

  throw new Error(`Parameter ${name} not found in SSM or .env`);
}

// Exported parameters
async function loadAppParameters() {
  const bucketName = await getParameter(
    '/bma2/s3_bucket',
    process.env.S3_BUCKET
  );

  const tableName = await getParameter(
    '/bma2/dynamodb_table',
    process.env.DYNAMO_TABLE
  );

  return { bucketName, tableName };
}

module.exports = { getParameter, loadAppParameters };

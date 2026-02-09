/**
 * Load Testing Script - 30,000 Emails
 * Generates and sends 30,000 dummy webhook notifications to test high throughput
 */

require("dotenv").config();
const http = require("http");
const { Pool } = require("pg");
const { SQSClient, GetQueueAttributesCommand } = require("@aws-sdk/client-sqs");

// Configuration
const config = {
  baseUrl: process.env.TEST_BASE_URL || "http://localhost:3000",
  mailboxId: process.env.TEST_MAILBOX_ID || "test-mailbox-001",
  channelId: process.env.TEST_CHANNEL_ID || "test-channel-id-123",
  email: process.env.TEST_EMAIL || "test@example.com",
  totalEmails: parseInt(process.env.LOAD_TEST_COUNT || "30000", 10),
  batchSize: parseInt(process.env.LOAD_TEST_BATCH_SIZE || "100", 10),
  concurrency: parseInt(process.env.LOAD_TEST_CONCURRENCY || "50", 10),
  delayBetweenBatches: parseInt(process.env.LOAD_TEST_DELAY || "100", 10), // milliseconds

  // Database
  dbHost: process.env.DB_HOST || "localhost",
  dbPort: process.env.DB_PORT || "5432",
  dbUsername: process.env.DB_USERNAME,
  dbPassword: process.env.DB_PASSWORD,
  dbDatabase: process.env.DB_DATABASE || "email_processing",

  // AWS
  awsRegion: process.env.AWS_REGION || "ap-south-1",
  ingestionQueueUrl: process.env.SQS_INGESTION_QUEUE_URL,
  processingQueueUrl: process.env.SQS_PROCESSING_QUEUE_URL,
  dbWriteQueueUrl: process.env.SQS_DB_WRITE_QUEUE_URL,
};

// Database connection
const dbPool = new Pool({
  host: config.dbHost,
  port: parseInt(config.dbPort, 10),
  user: config.dbUsername,
  password: config.dbPassword,
  database: config.dbDatabase,
});

// SQS Client
const sqsClient = new SQSClient({
  region: config.awsRegion,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Statistics
const stats = {
  total: config.totalEmails,
  sent: 0,
  succeeded: 0,
  failed: 0,
  startTime: null,
  endTime: null,
  errors: [],
};

// Helper functions
function log(message, color = "white") {
  const colors = {
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    white: "\x1b[0m",
  };
  console.log(`${colors[color] || ""}${message}\x1b[0m`);
}

function logSuccess(message) {
  log(`✅ ${message}`, "green");
}

function logError(message) {
  log(`❌ ${message}`, "red");
}

function logWarning(message) {
  log(`⚠️  ${message}`, "yellow");
}

function logInfo(message) {
  log(`ℹ️  ${message}`, "cyan");
}

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function base64Encode(str) {
  return Buffer.from(str).toString("base64");
}

function makeHttpRequest(options, data) {
  return new Promise((resolve, reject) => {
    try {
      const baseUrl = options.host || config.baseUrl;
      const fullUrl = baseUrl.startsWith("http")
        ? new URL(options.path, baseUrl)
        : new URL(`http://${baseUrl}${options.path}`);

      const requestOptions = {
        hostname: fullUrl.hostname,
        port: fullUrl.port || (fullUrl.protocol === "https:" ? 443 : 80),
        path: fullUrl.pathname + fullUrl.search,
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        timeout: 30000, // 30 second timeout
      };

      const req = http.request(requestOptions, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = body ? JSON.parse(body) : {};
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      });

      req.on("error", (error) => {
        reject(new Error(`HTTP request failed: ${error.message}`));
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("HTTP request timeout"));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    } catch (error) {
      reject(new Error(`Failed to create HTTP request: ${error.message}`));
    }
  });
}

async function sendWebhook(historyId, index) {
  const payload = {
    emailAddress: config.email,
    historyId: historyId.toString(),
  };

  const base64Data = base64Encode(JSON.stringify(payload));

  const webhookPayload = {
    message: {
      data: base64Data,
      messageId: `load-test-${index}-${Date.now()}`,
      publishTime: new Date().toISOString(),
      attributes: {
        googclient_channelid: config.channelId,
      },
    },
  };

  try {
    const response = await makeHttpRequest(
      { method: "POST", path: "/webhook/gmail" },
      webhookPayload,
    );

    stats.sent++;

    if (response.status === 200 && response.data.webhookNotificationId) {
      stats.succeeded++;
      return {
        success: true,
        notificationId: response.data.webhookNotificationId,
      };
    } else {
      stats.failed++;
      const errorMsg = JSON.stringify(response.data);
      stats.errors.push({ index, error: errorMsg });
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    stats.failed++;
    const errorMsg = error.message;
    stats.errors.push({ index, error: errorMsg });
    return { success: false, error: errorMsg };
  }
}

async function sendBatch(batchStart, batchEnd) {
  const promises = [];
  for (let i = batchStart; i < batchEnd; i++) {
    const historyId = Date.now() + i; // Unique history ID for each email
    promises.push(sendWebhook(historyId, i));
  }
  return Promise.allSettled(promises);
}

async function getQueueStats() {
  const stats = {
    ingestion: { visible: 0, inFlight: 0 },
    processing: { visible: 0, inFlight: 0 },
    dbWrite: { visible: 0, inFlight: 0 },
  };

  try {
    if (config.ingestionQueueUrl) {
      const cmd = new GetQueueAttributesCommand({
        QueueUrl: config.ingestionQueueUrl,
        AttributeNames: [
          "ApproximateNumberOfMessages",
          "ApproximateNumberOfMessagesNotVisible",
        ],
      });
      const resp = await sqsClient.send(cmd);
      stats.ingestion.visible = parseInt(
        resp.Attributes?.ApproximateNumberOfMessages || "0",
        10,
      );
      stats.ingestion.inFlight = parseInt(
        resp.Attributes?.ApproximateNumberOfMessagesNotVisible || "0",
        10,
      );
    }
  } catch (e) {
    // Ignore
  }

  try {
    if (config.processingQueueUrl) {
      const cmd = new GetQueueAttributesCommand({
        QueueUrl: config.processingQueueUrl,
        AttributeNames: [
          "ApproximateNumberOfMessages",
          "ApproximateNumberOfMessagesNotVisible",
        ],
      });
      const resp = await sqsClient.send(cmd);
      stats.processing.visible = parseInt(
        resp.Attributes?.ApproximateNumberOfMessages || "0",
        10,
      );
      stats.processing.inFlight = parseInt(
        resp.Attributes?.ApproximateNumberOfMessagesNotVisible || "0",
        10,
      );
    }
  } catch (e) {
    // Ignore
  }

  try {
    if (config.dbWriteQueueUrl) {
      const cmd = new GetQueueAttributesCommand({
        QueueUrl: config.dbWriteQueueUrl,
        AttributeNames: [
          "ApproximateNumberOfMessages",
          "ApproximateNumberOfMessagesNotVisible",
        ],
      });
      const resp = await sqsClient.send(cmd);
      stats.dbWrite.visible = parseInt(
        resp.Attributes?.ApproximateNumberOfMessages || "0",
        10,
      );
      stats.dbWrite.inFlight = parseInt(
        resp.Attributes?.ApproximateNumberOfMessagesNotVisible || "0",
        10,
      );
    }
  } catch (e) {
    // Ignore
  }

  return stats;
}

async function getDatabaseStats() {
  try {
    const webhookResult = await dbPool.query(
      "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE processed_st = 'completed') as completed, COUNT(*) FILTER (WHERE processed_st = 'failed') as failed FROM webhook_notifications WHERE deleted_at IS NULL",
    );

    const processedResult = await dbPool.query(
      "SELECT COUNT(*) as total FROM processed_emails WHERE deleted_at IS NULL",
    );

    return {
      webhooks: {
        total: parseInt(webhookResult.rows[0].total, 10),
        completed: parseInt(webhookResult.rows[0].completed, 10),
        failed: parseInt(webhookResult.rows[0].failed, 10),
      },
      processedEmails: {
        total: parseInt(processedResult.rows[0].total, 10),
      },
    };
  } catch (error) {
    return null;
  }
}

function printProgress() {
  const elapsed = stats.startTime ? Date.now() - stats.startTime : 0;
  const rate = elapsed > 0 ? (stats.sent / elapsed) * 1000 : 0; // per second
  const remaining = stats.total - stats.sent;
  const eta = rate > 0 ? remaining / rate : 0;

  process.stdout.write(
    `\r📊 Progress: ${formatNumber(stats.sent)}/${formatNumber(stats.total)} | ` +
      `✅ ${formatNumber(stats.succeeded)} ` +
      `Rate: ${rate.toFixed(1)}/sec | ETA: ${formatDuration(eta * 1000)}`,
  );
}

function printStats() {
  const duration = stats.endTime - stats.startTime;
  const rate = duration > 0 ? (stats.succeeded / duration) * 1000 : 0; // per second
  const hourlyRate = rate * 3600;

  log("\n═══════════════════════════════════════════════════════", "blue");
  log("  Load Test Results", "blue");
  log("═══════════════════════════════════════════════════════\n", "blue");

  log(`Total Emails: ${formatNumber(stats.total)}`);
  log(`Successfully Sent: ${formatNumber(stats.succeeded)}`, "green");
  log(
    `Failed: ${formatNumber(stats.failed)}`,
    stats.failed > 0 ? "red" : "green",
  );
  log(`Duration: ${formatDuration(duration)}`);
  log(`Throughput: ${rate.toFixed(2)} emails/second`);
  log(`Hourly Rate: ${formatNumber(Math.floor(hourlyRate))} emails/hour`);

  if (stats.failed > 0 && stats.errors.length > 0) {
    log(`\n⚠️  Sample Errors (first 5):`, "yellow");
    stats.errors.slice(0, 5).forEach((err, i) => {
      log(
        `  ${i + 1}. Email #${err.index}: ${err.error.substring(0, 100)}`,
        "yellow",
      );
    });
  }
}

async function monitorQueues() {
  log("\n📊 Monitoring Queue Status...\n", "cyan");

  const queueStats = await getQueueStats();
  log(
    `Ingestion Queue: ${formatNumber(queueStats.ingestion.visible)} visible, ${formatNumber(queueStats.ingestion.inFlight)} in-flight`,
  );
  log(
    `Processing Queue: ${formatNumber(queueStats.processing.visible)} visible, ${formatNumber(queueStats.processing.inFlight)} in-flight`,
  );
  log(
    `DB Write Queue: ${formatNumber(queueStats.dbWrite.visible)} visible, ${formatNumber(queueStats.dbWrite.inFlight)} in-flight`,
  );

  const dbStats = await getDatabaseStats();
  if (dbStats) {
    log(`\nDatabase Stats:`, "cyan");
    log(
      `  Webhook Notifications: ${formatNumber(dbStats.webhooks.total)} total, ${formatNumber(dbStats.webhooks.completed)} completed, ${formatNumber(dbStats.webhooks.failed)} failed`,
    );
    log(`  Processed Emails: ${formatNumber(dbStats.processedEmails.total)}`);
  }
}

// Main function
async function runLoadTest() {
  log("\n═══════════════════════════════════════════════════════", "blue");
  log("  Load Test: 30,000 Emails", "blue");
  log("═══════════════════════════════════════════════════════\n", "blue");

  log("Configuration:", "cyan");
  log(`  Total Emails: ${formatNumber(config.totalEmails)}`);
  log(`  Batch Size: ${formatNumber(config.batchSize)}`);
  log(`  Concurrency: ${formatNumber(config.concurrency)}`);
  log(`  Delay Between Batches: ${config.delayBetweenBatches}ms`);
  log(`  Webhook URL: ${config.baseUrl}/webhook/gmail`);
  log(`  Mailbox ID: ${config.mailboxId}`);
  log(`  Channel ID: ${config.channelId}\n`);

  // Check if webhook API is running
  log("Checking webhook API...");
  try {
    const healthCheck = await makeHttpRequest({
      method: "GET",
      path: "/health",
    });
    if (healthCheck.status === 200) {
      logSuccess("Webhook API is running");
    } else {
      logError("Webhook API health check failed");
      process.exit(1);
    }
  } catch (error) {
    logError(`Webhook API is not accessible: ${error.message}`);
    logError("Please start the webhook API: npm run dev");
    process.exit(1);
  }

  // Confirm before starting
  log(
    `\n⚠️  This will send ${formatNumber(config.totalEmails)} webhook notifications.`,
    "yellow",
  );
  log("Press Ctrl+C to cancel, or wait 5 seconds to start...\n", "yellow");

  await new Promise((resolve) => setTimeout(resolve, 5000));

  log("\n🚀 Starting load test...\n", "green");
  stats.startTime = Date.now();

  // Send emails in batches
  const totalBatches = Math.ceil(config.totalEmails / config.batchSize);

  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const batchStart = batchNum * config.batchSize;
    const batchEnd = Math.min(
      batchStart + config.batchSize,
      config.totalEmails,
    );

    // Process batch with concurrency
    const batchPromises = [];
    for (let i = 0; i < config.concurrency && batchStart + i < batchEnd; i++) {
      const chunkStart = batchStart + i;
      const chunkSize = Math.min(config.concurrency, batchEnd - chunkStart);
      const chunkEnd = chunkStart + chunkSize;

      batchPromises.push(
        (async () => {
          for (let j = chunkStart; j < chunkEnd; j += config.concurrency) {
            const chunkEndIdx = Math.min(j + config.concurrency, chunkEnd);
            await sendBatch(j, chunkEndIdx);
            printProgress();
          }
        })(),
      );
    }

    await Promise.all(batchPromises);

    // Delay between batches to avoid overwhelming the system
    if (batchNum < totalBatches - 1 && config.delayBetweenBatches > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, config.delayBetweenBatches),
      );
    }
  }

  stats.endTime = Date.now();
  printStats();

  // Wait a bit for processing
  log("\n⏳ Waiting 10 seconds for initial processing...", "cyan");
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Monitor queues
  await monitorQueues();

  log("\n✅ Load test completed!", "green");
  log("\nNext steps:", "cyan");
  log(
    "  1. Monitor queues: npm run test:layer 2 (ingestion), 3 (processing), 4 (db-write)",
  );
  log("  2. Check database: npm run test:layer 5");
  log("  3. Ensure workers are running to process the messages");
  log("     - npm run worker:email-fetcher");
  log("     - npm run worker:attachment-processor");
  log("     - npm run worker:db-writer");
}

// Cleanup and exit
process.on("SIGINT", async () => {
  log("\n\n⚠️  Load test interrupted by user", "yellow");
  printStats();
  await dbPool.end();
  process.exit(0);
});

// Run test
if (require.main === module) {
  runLoadTest()
    .then(async () => {
      await dbPool.end();
      process.exit(0);
    })
    .catch(async (error) => {
      logError(`Fatal error: ${error.message}`);
      console.error(error);
      await dbPool.end();
      process.exit(1);
    });
}

module.exports = { runLoadTest };

require("dotenv").config();
const http = require("http");
const { Pool } = require("pg");
const {
  SQSClient,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} = require("@aws-sdk/client-sqs");

// Configuration
const config = {
  baseUrl: process.env.TEST_BASE_URL || "http://localhost:3000",
  mailboxId: process.env.TEST_MAILBOX_ID || "test-mailbox-001",
  channelId: process.env.TEST_CHANNEL_ID || "test-channel-id-123",
  email: process.env.TEST_EMAIL || "test@example.com",
  dbHost: process.env.DB_HOST || "localhost",
  dbPort: process.env.DB_PORT || "5432",
  dbUsername: process.env.DB_USERNAME || "your_username",
  dbPassword: process.env.DB_PASSWORD || "your_password",
  dbDatabase: process.env.DB_DATABASE || "email_processing",
  awsRegion: process.env.AWS_REGION || "ap-south-1",
  ingestionQueueUrl: process.env.SQS_INGESTION_QUEUE_URL,
  processingQueueUrl: process.env.SQS_PROCESSING_QUEUE_URL,
  dbWriteQueueUrl: process.env.SQS_DB_WRITE_QUEUE_URL,
  dlqUrl: process.env.SQS_DLQ_URL,
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

// Helper Functions
function log(message, color = "white") {
  const colors = {
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    white: "\x1b[0m",
  };
  console.log(`${colors[color] || ""}${message}\x1b[0m`);
}

function logStep(step, title) {
  log(`\n[Step ${step}] ${title}`, "blue");
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

      req.setTimeout(10000, () => {
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

async function queryDatabase(query, params = []) {
  try {
    const result = await dbPool.query(query, params);
    return result.rows;
  } catch (error) {
    logError(`Database query failed: ${error.message}`);
    throw error;
  }
}

async function getQueueMessageCount(queueUrl) {
  try {
    const command = new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: [
        "ApproximateNumberOfMessages",
        "ApproximateNumberOfMessagesNotVisible", // In-flight messages
        "VisibilityTimeout",
      ],
    });
    const response = await sqsClient.send(command);
    const visible = parseInt(
      response.Attributes?.ApproximateNumberOfMessages || "0",
      10,
    );
    const inFlight = parseInt(
      response.Attributes?.ApproximateNumberOfMessagesNotVisible || "0",
      10,
    );
    const visibilityTimeout = parseInt(
      response.Attributes?.VisibilityTimeout || "30",
      10,
    );

    return {
      visible,
      inFlight,
      visibilityTimeout,
      total: visible + inFlight,
    };
  } catch (error) {
    logWarning(`Could not get queue count: ${error.message}`);
    return { visible: -1, inFlight: -1, visibilityTimeout: 30, total: -1 };
  }
}

async function receiveAndInspectMessage(queueUrl, queueName) {
  try {
    // For FIFO queues, use longer wait time and check for in-flight messages
    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10, // Get up to 10 messages
      WaitTimeSeconds: 20, // Long polling for FIFO queues
      AttributeNames: ["All"], // Get all attributes including ApproximateReceiveCount
    });
    const response = await sqsClient.send(command);

    if (response.Messages && response.Messages.length > 0) {
      // Show all received messages
      logSuccess(
        `Found ${response.Messages.length} message(s) in ${queueName}:`,
      );

      response.Messages.forEach((message, index) => {
        log(`\n--- Message ${index + 1} ---`);
        log(`  Message ID: ${message.MessageId}`);
        log(`  Receipt Handle: ${message.ReceiptHandle?.substring(0, 50)}...`);

        // Show message attributes
        if (message.Attributes) {
          log(
            `  Receive Count: ${message.Attributes.ApproximateReceiveCount || "N/A"}`,
          );
          log(
            `  Sent Timestamp: ${message.Attributes.SentTimestamp ? new Date(parseInt(message.Attributes.SentTimestamp)).toISOString() : "N/A"}`,
          );
        }

        // Parse and show message body
        try {
          const body = JSON.parse(message.Body || "{}");
          log(`  Body: ${JSON.stringify(body, null, 2)}`);
        } catch (e) {
          log(`  Body (raw): ${message.Body}`);
        }
      });

      return response.Messages[0]; // Return first message
    } else {
      logWarning(`No messages available in ${queueName}`);
      log(`Note: Messages might be in-flight (being processed by a worker)`);
      log(
        `High receive counts in the queue UI indicate messages are being received but not deleted`,
      );
      return null;
    }
  } catch (error) {
    logError(`Failed to receive message from ${queueName}: ${error.message}`);
    return null;
  }
}

// Layer Tests
async function testLayer1_Webhook() {
  logStep(1, "Testing Layer 1: Webhook API");

  const historyId = Date.now();
  const payload = {
    emailAddress: config.email,
    historyId: historyId.toString(),
  };

  const base64Data = base64Encode(JSON.stringify(payload));
  const gmailMessageId = `${config.email}-${historyId}`;

  const webhookPayload = {
    message: {
      data: base64Data,
      messageId: `test-message-id-${Date.now()}`,
      publishTime: new Date().toISOString(),
      attributes: {
        googclient_channelid: config.channelId,
      },
    },
  };

  log(`Sending webhook with historyId: ${historyId}`);
  log(`Channel ID: ${config.channelId}`);
  log(`Mailbox ID: ${config.mailboxId}`);

  let response;
  try {
    response = await makeHttpRequest(
      { method: "POST", path: "/webhook/gmail" },
      webhookPayload,
    );
  } catch (error) {
    logError(`HTTP request failed: ${error.message}`);
    logError(`Make sure the webhook API is running at ${config.baseUrl}`);
    logError(`Run: npm run dev`);
    throw error;
  }

  log(`Response status: ${response.status}`);
  log(`Response data: ${JSON.stringify(response.data, null, 2)}`);

  // Check for SQS errors
  if (response.data.sqsError || response.data.warning) {
    logError(
      `\n⚠️  SQS Error: ${response.data.sqsError || response.data.warning}`,
    );
    logError(
      `   The webhook was saved to database but failed to send to ingestion queue.`,
    );
    logError(`   Common causes:`);
    logError(`   1. Missing SQS_INGESTION_QUEUE_URL in .env`);
    logError(
      `   2. AWS credentials not configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)`,
    );
    logError(`   3. AWS region not set (AWS_REGION)`);
    logError(`   4. IAM permissions missing (sqs:SendMessage)`);
    logError(`   5. Queue URL incorrect`);
  }

  if (response.status === 200 && response.data.webhookNotificationId) {
    logSuccess(
      `Webhook processed! Notification ID: ${response.data.webhookNotificationId}`,
    );

    // Verify in database
    const records = await queryDatabase(
      "SELECT id, mailbox_id, gmail_message_id, history_id, processed_st FROM webhook_notifications WHERE id = $1",
      [response.data.webhookNotificationId],
    );

    if (records.length > 0) {
      logSuccess(`Verified in database: ${JSON.stringify(records[0])}`);
    }

    // Check if message was sent to queue
    if (!response.data.sqsError && !response.data.warning) {
      logSuccess(`Message sent to ingestion queue successfully`);
    } else {
      logWarning(
        `Message NOT sent to ingestion queue - check SQS configuration`,
      );
    }

    return {
      webhookNotificationId: response.data.webhookNotificationId,
      gmailMessageId,
      historyId,
    };
  } else if (response.status === 200 && response.data.message) {
    logWarning(`Webhook returned success but no notification ID`);
    logWarning(`Response: ${JSON.stringify(response.data)}`);

    // Try to find in database by gmail_message_id
    const fallbackRecords = await queryDatabase(
      "SELECT id, mailbox_id, gmail_message_id, history_id FROM webhook_notifications WHERE gmail_message_id = $1 ORDER BY received_at DESC LIMIT 1",
      [gmailMessageId],
    );

    if (fallbackRecords.length > 0) {
      logSuccess(
        `Found notification in database with ID: ${fallbackRecords[0].id}`,
      );
      return {
        webhookNotificationId: fallbackRecords[0].id,
        gmailMessageId,
        historyId,
      };
    }

    throw new Error(
      `Webhook processed but notification ID not returned: ${JSON.stringify(response.data)}`,
    );
  } else {
    throw new Error(`Webhook failed: ${JSON.stringify(response.data)}`);
  }
}

async function testLayer2_IngestionQueue() {
  logStep(2, "Testing Layer 2: Ingestion Queue");

  if (!config.ingestionQueueUrl) {
    logWarning("Ingestion queue URL not configured");
    return;
  }

  const queueStats = await getQueueMessageCount(config.ingestionQueueUrl);
  log(`Queue Statistics:`);
  log(`  Visible messages: ${queueStats.visible}`);
  log(`  In-flight messages: ${queueStats.inFlight}`);
  log(`  Total messages: ${queueStats.total}`);
  log(`  Visibility timeout: ${queueStats.visibilityTimeout} seconds`);

  if (queueStats.inFlight > 0) {
    logWarning(
      `\n⚠️  ${queueStats.inFlight} message(s) are IN-FLIGHT (being processed)`,
    );
    log(
      `   This means a worker has received them but hasn't deleted them yet.`,
    );
    log(
      `   They will become visible again in ${queueStats.visibilityTimeout} seconds if not deleted.`,
    );
    log(
      `   High receive counts indicate the worker is failing to process them.`,
    );
    log(`\n   Solutions:`);
    log(
      `   1. Stop any running workers: Check for 'npm run worker:email-fetcher' processes`,
    );
    log(
      `   2. Wait ${queueStats.visibilityTimeout} seconds for messages to become visible`,
    );
    log(`   3. Fix the worker errors so messages get deleted after processing`);
  }

  if (queueStats.visible > 0) {
    log("\nInspecting visible messages from ingestion queue...");
    const message = await receiveAndInspectMessage(
      config.ingestionQueueUrl,
      "Ingestion Queue",
    );

    if (message) {
      log("\nTo process this message, run: npm run worker:email-fetcher");
    }
  } else if (queueStats.total === 0) {
    logWarning(
      "No messages in ingestion queue. Send a webhook first (Layer 1)",
    );
  } else {
    logWarning(
      `All ${queueStats.total} message(s) are currently in-flight. Wait for visibility timeout or stop workers.`,
    );
  }
}

async function testLayer3_ProcessingQueue() {
  logStep(3, "Testing Layer 3: Processing Queue");

  if (!config.processingQueueUrl) {
    logWarning("Processing queue URL not configured");
    return;
  }

  const queueStats = await getQueueMessageCount(config.processingQueueUrl);
  log(`Queue Statistics:`);
  log(`  Visible messages: ${queueStats.visible}`);
  log(`  In-flight messages: ${queueStats.inFlight}`);
  log(`  Total messages: ${queueStats.total}`);

  if (queueStats.inFlight > 0) {
    logWarning(`\n⚠️  ${queueStats.inFlight} message(s) are IN-FLIGHT`);
    log(
      `   Wait ${queueStats.visibilityTimeout} seconds or stop workers to make them visible.`,
    );
  }

  if (queueStats.visible > 0) {
    log("Inspecting a message from processing queue...");
    const message = await receiveAndInspectMessage(
      config.processingQueueUrl,
      "Processing Queue",
    );

    if (message) {
      log(
        "\nTo process this message, run: npm run worker:attachment-processor",
      );
    }
  } else if (queueStats.total === 0) {
    logWarning(
      "No messages in processing queue. Process ingestion queue first (Layer 2)",
    );
  } else {
    logWarning(
      `All messages are currently in-flight. Wait for visibility timeout.`,
    );
  }
}

async function testLayer4_DbWriteQueue() {
  logStep(4, "Testing Layer 4: DB Write Queue");

  if (!config.dbWriteQueueUrl) {
    logWarning("DB write queue URL not configured");
    return;
  }

  const queueStats = await getQueueMessageCount(config.dbWriteQueueUrl);
  log(`Queue Statistics:`);
  log(`  Visible messages: ${queueStats.visible}`);
  log(`  In-flight messages: ${queueStats.inFlight}`);
  log(`  Total messages: ${queueStats.total}`);

  if (queueStats.inFlight > 0) {
    logWarning(`\n⚠️  ${queueStats.inFlight} message(s) are IN-FLIGHT`);
    log(
      `   Wait ${queueStats.visibilityTimeout} seconds or stop workers to make them visible.`,
    );
  }

  if (queueStats.visible > 0) {
    log("Inspecting a message from DB write queue...");
    const message = await receiveAndInspectMessage(
      config.dbWriteQueueUrl,
      "DB Write Queue",
    );

    if (message) {
      log("\nTo process this message, run: npm run worker:db-writer");
    }
  } else if (queueStats.total === 0) {
    logWarning(
      "No messages in DB write queue. Process processing queue first (Layer 3)",
    );
  } else {
    logWarning(
      `All messages are currently in-flight. Wait for visibility timeout.`,
    );
  }
}

async function testLayer5_Database() {
  logStep(5, "Testing Layer 5: Database (Processed Emails)");

  const records = await queryDatabase(
    "SELECT id, mailbox_id, gmail_message_id, subject, sender_email, attachments_count, processed_at FROM processed_emails WHERE deleted_at IS NULL ORDER BY processed_at DESC LIMIT 5",
  );

  if (records.length > 0) {
    logSuccess(`Found ${records.length} processed email(s):`);
    records.forEach((record, index) => {
      log(`\n${index + 1}. ${JSON.stringify(record, null, 2)}`);
    });
  } else {
    logWarning(
      "No processed emails found. Process DB write queue first (Layer 4)",
    );
  }
}

async function testLayer6_QueryAPIs() {
  logStep(6, "Testing Layer 6: Query APIs");

  // Test GET /emails
  log("Testing GET /emails");
  const allEmails = await makeHttpRequest({
    method: "GET",
    path: "/emails?limit=5",
  });
  if (allEmails.status === 200) {
    logSuccess(`Query API returned ${allEmails.data.total || 0} emails`);
  } else {
    logError(`Query API failed: ${JSON.stringify(allEmails.data)}`);
  }

  // Test GET /emails/mailbox/:mailboxId
  log(`\nTesting GET /emails/mailbox/${config.mailboxId}`);
  const mailboxEmails = await makeHttpRequest({
    method: "GET",
    path: `/emails/mailbox/${config.mailboxId}?limit=5`,
  });
  if (mailboxEmails.status === 200) {
    logSuccess(`Retrieved ${mailboxEmails.data.total || 0} emails for mailbox`);
  } else {
    logError(`Mailbox query failed: ${JSON.stringify(mailboxEmails.data)}`);
  }
}

async function testLayer7_DLQ() {
  logStep(7, "Testing Layer 7: Dead Letter Queue (DLQ)");

  if (!config.dlqUrl) {
    logWarning("DLQ URL not configured");
    return;
  }

  const count = await getQueueMessageCount(config.dlqUrl);
  log(`Messages in DLQ: ${count}`);

  if (count > 0) {
    log("Inspecting a message from DLQ...");
    const message = await receiveAndInspectMessage(config.dlqUrl, "DLQ");

    if (message) {
      log("\nTo process DLQ messages, run: npm run worker:dlq-processor");
    }
  } else {
    logSuccess("DLQ is empty (no failed messages)");
  }
}

// Main function
async function runLayerTest() {
  const layer = process.argv[2];

  log("\n═══════════════════════════════════════════════════════", "blue");
  log("  Email Processing Service - Layer-by-Layer Testing", "blue");
  log("═══════════════════════════════════════════════════════\n", "blue");

  try {
    switch (layer) {
      case "1":
      case "webhook":
        await testLayer1_Webhook();
        break;
      case "2":
      case "ingestion":
        await testLayer2_IngestionQueue();
        break;
      case "3":
      case "processing":
        await testLayer3_ProcessingQueue();
        break;
      case "4":
      case "db-write":
        await testLayer4_DbWriteQueue();
        break;
      case "5":
      case "database":
        await testLayer5_Database();
        break;
      case "6":
      case "query":
        await testLayer6_QueryAPIs();
        break;
      case "7":
      case "dlq":
        await testLayer7_DLQ();
        break;
      case "all":
        await testLayer1_Webhook();
        await testLayer2_IngestionQueue();
        await testLayer3_ProcessingQueue();
        await testLayer4_DbWriteQueue();
        await testLayer5_Database();
        await testLayer6_QueryAPIs();
        await testLayer7_DLQ();
        break;
      default:
        log("Usage: node test-layer-by-layer.js <layer>", "yellow");
        log("\nAvailable layers:", "yellow");
        log("  1 or webhook      - Test webhook API", "white");
        log("  2 or ingestion    - Check ingestion queue", "white");
        log("  3 or processing   - Check processing queue", "white");
        log("  4 or db-write     - Check DB write queue", "white");
        log(
          "  5 or database     - Check processed emails in database",
          "white",
        );
        log("  6 or query        - Test query APIs", "white");
        log("  7 or dlq          - Check DLQ", "white");
        log("  all               - Test all layers", "white");
        log("\nExamples:", "yellow");
        log("  node test-layer-by-layer.js 1", "white");
        log("  node test-layer-by-layer.js webhook", "white");
        log("  node test-layer-by-layer.js all", "white");
        process.exit(1);
    }

    log("\n✅ Layer test completed!", "green");
  } catch (error) {
    logError(`Test failed: ${error.message}`);
    process.exit(1);
  } finally {
    await dbPool.end();
  }
}

// Run tests
if (require.main === module) {
  runLayerTest().catch((error) => {
    logError(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

module.exports = { runLayerTest };

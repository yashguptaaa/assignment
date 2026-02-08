import {
  receiveMessagesFromDLQ,
  deleteMessageFromDLQ,
} from "../services/sqs.service";
import { updateWebhookStatus } from "../repositories/webhook.repository";
import {
  IngestionQueueMessage,
  ProcessingQueueMessage,
  DbWriteQueueMessage,
} from "../types/queueMessages";

const BATCH_SIZE = parseInt(process.env.DLQ_PROCESSOR_BATCH_SIZE || "10", 10);

const isIngestionMessage = (msg: unknown): msg is IngestionQueueMessage => {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "mailboxId" in msg &&
    "gmailMessageId" in msg &&
    "historyId" in msg &&
    "webhookNotificationId" in msg &&
    !("emailMetadata" in msg) &&
    !("attachments" in msg)
  );
};

const isProcessingMessage = (msg: unknown): msg is ProcessingQueueMessage => {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "mailboxId" in msg &&
    "gmailMessageId" in msg &&
    "historyId" in msg &&
    "webhookNotificationId" in msg &&
    "emailMetadata" in msg &&
    !("attachments" in msg)
  );
};

const isDbWriteMessage = (msg: unknown): msg is DbWriteQueueMessage => {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "mailboxId" in msg &&
    "gmailMessageId" in msg &&
    "historyId" in msg &&
    "webhookNotificationId" in msg &&
    "attachments" in msg
  );
};

const processDLQMessage = async (
  message: unknown,
  receiptHandle: string,
  attributes: Record<string, string>,
): Promise<void> => {
  try {
    let webhookNotificationId: number | undefined;

    if (isIngestionMessage(message)) {
      webhookNotificationId = message.webhookNotificationId;
    } else if (isProcessingMessage(message)) {
      webhookNotificationId = message.webhookNotificationId;
    } else if (isDbWriteMessage(message)) {
      webhookNotificationId = message.webhookNotificationId;
    } else {
      throw new Error("Unknown message type in DLQ");
    }

    if (webhookNotificationId) {
      const errorMessage = attributes["ApproximateReceiveCount"]
        ? `Message failed after ${attributes["ApproximateReceiveCount"]} retries`
        : "Message failed processing and reached DLQ";

      await updateWebhookStatus(webhookNotificationId, "failed", errorMessage);
    }

    await deleteMessageFromDLQ(receiptHandle);
  } catch (error) {
    throw error;
  }
};

const runWorker = async (): Promise<void> => {
  while (true) {
    try {
      const messages = await receiveMessagesFromDLQ(BATCH_SIZE);

      if (!messages || messages.length === 0) {
        continue;
      }

      const promises = messages.map((msg) =>
        processDLQMessage(
          msg.body,
          msg.receiptHandle,
          msg.attributes || {},
        ).catch(() => {
          // Continue processing other messages even if one fails
        }),
      );

      await Promise.allSettled(promises);
    } catch (error) {
      continue;
    }
  }
};

if (require.main === module) {
  runWorker().catch(() => {
    process.exit(1);
  });
}

export { runWorker, processDLQMessage };

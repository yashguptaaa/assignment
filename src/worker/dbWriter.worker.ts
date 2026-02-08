import {
  receiveMessagesFromDbWriteQueue,
  deleteMessageFromDbWriteQueue,
} from "../services/sqs.service";
import { batchInsertProcessedEmails } from "../repositories/processedEmail.repository";
import { updateWebhookStatus } from "../repositories/webhook.repository";
import { DbWriteQueueMessage } from "../types/queueMessages";

const CONCURRENCY = parseInt(process.env.DB_WRITER_CONCURRENCY || "3", 10);
const BATCH_SIZE = parseInt(process.env.DB_WRITER_BATCH_SIZE || "25", 10);
const DB_WRITE_BATCH_SIZE = parseInt(
  process.env.DB_WRITE_BATCH_SIZE || "10",
  10,
);

const processMessage = async (
  message: DbWriteQueueMessage,
  receiptHandle: string,
): Promise<void> => {
  try {
    await batchInsertProcessedEmails([message]);
    await updateWebhookStatus(message.webhookNotificationId, "completed");
    await deleteMessageFromDbWriteQueue(receiptHandle);
  } catch (error) {
    await updateWebhookStatus(
      message.webhookNotificationId,
      "failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    throw error;
  }
};

const processBatch = async (
  messages: Array<{ receiptHandle: string; body: DbWriteQueueMessage }>,
): Promise<void> => {
  const dbWriteBatches: Array<DbWriteQueueMessage[]> = [];
  const receiptHandles: string[] = messages.map((msg) => msg.receiptHandle);

  for (let i = 0; i < messages.length; i += DB_WRITE_BATCH_SIZE) {
    dbWriteBatches.push(
      messages.slice(i, i + DB_WRITE_BATCH_SIZE).map((msg) => msg.body),
    );
  }

  for (let i = 0; i < dbWriteBatches.length; i++) {
    const batch = dbWriteBatches[i];
    const batchReceiptHandles = receiptHandles.slice(
      i * DB_WRITE_BATCH_SIZE,
      (i + 1) * DB_WRITE_BATCH_SIZE,
    );

    try {
      const results = await batchInsertProcessedEmails(batch);

      for (let j = 0; j < batch.length; j++) {
        const message = batch[j];
        const result = results[j];

        if (result) {
          await updateWebhookStatus(message.webhookNotificationId, "completed");
          await deleteMessageFromDbWriteQueue(batchReceiptHandles[j]);
        } else {
          await updateWebhookStatus(
            message.webhookNotificationId,
            "failed",
            "Failed to insert email",
          );
        }
      }
    } catch (error) {
      for (const message of batch) {
        await updateWebhookStatus(
          message.webhookNotificationId,
          "failed",
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    }
  }
};

const runWorker = async (): Promise<void> => {
  while (true) {
    try {
      const messages = await receiveMessagesFromDbWriteQueue(BATCH_SIZE);

      if (!messages || messages.length === 0) {
        continue;
      }

      const batches: Array<
        Array<{ receiptHandle: string; body: DbWriteQueueMessage }>
      > = [];
      for (let i = 0; i < messages.length; i += CONCURRENCY) {
        batches.push(messages.slice(i, i + CONCURRENCY));
      }

      for (const batch of batches) {
        await processBatch(batch);
      }
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

export { runWorker, processMessage };

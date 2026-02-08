import {
  receiveMessagesFromProcessingQueue,
  deleteMessageFromProcessingQueue,
  sendToDbWriteQueue,
} from "../services/sqs.service";
import { getMailboxWithCredentials } from "../repositories/mailbox.repository";
import { downloadAttachment } from "../services/gmail.service";
import { uploadAttachmentToS3, generateS3Key } from "../services/s3.service";
import { decrypt } from "../services/encryption.service";
import {
  ProcessingQueueMessage,
  DbWriteQueueMessage,
  AttachmentMetadata,
} from "../types/queueMessages";

const CONCURRENCY = parseInt(
  process.env.ATTACHMENT_PROCESSOR_CONCURRENCY || "5",
  10,
);
const BATCH_SIZE = parseInt(
  process.env.ATTACHMENT_PROCESSOR_BATCH_SIZE || "10",
  10,
);
const ATTACHMENT_DOWNLOAD_CONCURRENCY = parseInt(
  process.env.ATTACHMENT_DOWNLOAD_CONCURRENCY || "3",
  10,
);
const S3_BUCKET = process.env.S3_BUCKET_NAME;
if (!S3_BUCKET) {
  throw new Error("S3_BUCKET_NAME environment variable is not set");
}

const downloadAndUploadAttachment = async (
  mailboxId: string,
  gmailMessageId: string,
  clientId: string,
  accessToken: string,
  refreshToken: string,
  attachment: {
    attachmentId: string;
    filename: string;
    mimeType: string;
    size: number;
  },
): Promise<AttachmentMetadata> => {
  const attachmentData = await downloadAttachment(
    clientId,
    accessToken,
    refreshToken,
    gmailMessageId,
    attachment.attachmentId,
  );

  const s3Key = generateS3Key(
    mailboxId,
    gmailMessageId,
    attachment.attachmentId,
    attachment.filename,
  );
  await uploadAttachmentToS3(
    S3_BUCKET,
    s3Key,
    attachmentData.data,
    attachment.mimeType || attachmentData.mimeType,
    attachmentData.size,
  );

  return {
    filename: attachment.filename,
    contentType: attachment.mimeType || attachmentData.mimeType,
    size: attachmentData.size,
    s3Key,
    attachmentId: attachment.attachmentId,
  };
};

const processAttachments = async (
  mailboxId: string,
  gmailMessageId: string,
  clientId: string,
  accessToken: string,
  refreshToken: string,
  attachments: Array<{
    attachmentId: string;
    filename: string;
    mimeType: string;
    size: number;
  }>,
): Promise<AttachmentMetadata[]> => {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  const batches: Array<
    Array<{
      attachmentId: string;
      filename: string;
      mimeType: string;
      size: number;
    }>
  > = [];
  for (
    let i = 0;
    i < attachments.length;
    i += ATTACHMENT_DOWNLOAD_CONCURRENCY
  ) {
    batches.push(attachments.slice(i, i + ATTACHMENT_DOWNLOAD_CONCURRENCY));
  }

  const results: AttachmentMetadata[] = [];

  for (const batch of batches) {
    const batchResults = await Promise.allSettled(
      batch.map((attachment) =>
        downloadAndUploadAttachment(
          mailboxId,
          gmailMessageId,
          clientId,
          accessToken,
          refreshToken,
          attachment,
        ),
      ),
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }
  }

  return results;
};

const processMessage = async (
  message: ProcessingQueueMessage,
  receiptHandle: string,
): Promise<void> => {
  try {
    const mailbox = await getMailboxWithCredentials(message.mailboxId);
    if (!mailbox) {
      throw new Error(`Mailbox not found: ${message.mailboxId}`);
    }

    const decryptedAccessToken = decrypt(mailbox.accessToken);
    const decryptedRefreshToken = decrypt(mailbox.refreshToken);

    const attachments: AttachmentMetadata[] = message.attachmentIds
      ? await processAttachments(
          message.mailboxId,
          message.gmailMessageId,
          mailbox.clientId,
          decryptedAccessToken,
          decryptedRefreshToken,
          message.attachmentIds,
        )
      : [];

    const dbWriteMessage: DbWriteQueueMessage = {
      mailboxId: message.mailboxId,
      gmailMessageId: message.gmailMessageId,
      historyId: message.historyId,
      subject: message.emailMetadata.subject,
      senderEmail: message.emailMetadata.sender,
      recipientEmail: message.emailMetadata.recipients?.join(",") || undefined,
      ccEmail: message.emailMetadata.cc?.join(",") || undefined,
      bccEmail: message.emailMetadata.bcc?.join(",") || undefined,
      body: message.emailMetadata.body,
      attachments,
      attachmentsCount: attachments.length,
      threadId: message.emailMetadata.threadId,
      receivedAt: message.emailMetadata.receivedAt,
      webhookNotificationId: message.webhookNotificationId,
    };

    await sendToDbWriteQueue(dbWriteMessage);
    await deleteMessageFromProcessingQueue(receiptHandle);
  } catch (error) {
    throw error;
  }
};

const processBatch = async (
  messages: Array<{ receiptHandle: string; body: ProcessingQueueMessage }>,
): Promise<void> => {
  const promises = messages.map((msg) =>
    processMessage(msg.body, msg.receiptHandle),
  );
  await Promise.allSettled(promises);
};

const runWorker = async (): Promise<void> => {
  while (true) {
    try {
      const messages = await receiveMessagesFromProcessingQueue(BATCH_SIZE);

      if (!messages || messages.length === 0) {
        continue;
      }

      const batches: Array<
        Array<{ receiptHandle: string; body: ProcessingQueueMessage }>
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

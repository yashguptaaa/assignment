import { receiveMessagesFromIngestionQueue, deleteMessageFromIngestionQueue, sendToProcessingQueue } from '../services/sqs.service';
import { getMailboxWithCredentials } from '../repositories/mailbox.repository';
import { fetchEmailMetadata, getMessageIdFromHistoryId } from '../services/gmail.service';
import { decrypt } from '../services/encryption.service';
import { IngestionQueueMessage, ProcessingQueueMessage } from '../types/queueMessages';

const CONCURRENCY = parseInt(process.env.EMAIL_FETCHER_CONCURRENCY || '5', 10);
const BATCH_SIZE = parseInt(process.env.EMAIL_FETCHER_BATCH_SIZE || '10', 10);

const processMessage = async (message: IngestionQueueMessage, receiptHandle: string): Promise<void> => {
  try {
    const mailbox = await getMailboxWithCredentials(message.mailboxId);
    if (!mailbox) {
      throw new Error(`Mailbox not found: ${message.mailboxId}`);
    }

    const decryptedAccessToken = decrypt(mailbox.accessToken);
    const decryptedRefreshToken = decrypt(mailbox.refreshToken);

    let gmailMessageId = message.gmailMessageId;
    
    if (gmailMessageId.includes('@') || gmailMessageId.includes('-')) {
      const messageId = await getMessageIdFromHistoryId(
        mailbox.clientId,
        decryptedAccessToken,
        decryptedRefreshToken,
        message.historyId
      );
      if (messageId) {
        gmailMessageId = messageId;
      } else {
        throw new Error(`Unable to resolve Gmail message ID for historyId: ${message.historyId}`);
      }
    }

    const emailMetadata = await fetchEmailMetadata(
      mailbox.clientId,
      decryptedAccessToken,
      decryptedRefreshToken,
      gmailMessageId
    );

    const processingMessage: ProcessingQueueMessage = {
      mailboxId: message.mailboxId,
      gmailMessageId: gmailMessageId,
      historyId: message.historyId,
      emailMetadata: {
        subject: emailMetadata.subject,
        sender: emailMetadata.sender,
        recipients: emailMetadata.recipients,
        cc: emailMetadata.cc,
        bcc: emailMetadata.bcc,
        body: emailMetadata.body,
        threadId: emailMetadata.threadId,
        receivedAt: emailMetadata.receivedAt,
      },
      attachmentIds: emailMetadata.attachmentIds,
      webhookNotificationId: message.webhookNotificationId,
    };

    await sendToProcessingQueue(processingMessage);
    await deleteMessageFromIngestionQueue(receiptHandle);
  } catch (error) {
    throw error;
  }
};

const processBatch = async (messages: Array<{ receiptHandle: string; body: IngestionQueueMessage }>): Promise<void> => {
  const promises = messages.map((msg) => processMessage(msg.body, msg.receiptHandle));
  await Promise.allSettled(promises);
};

const runWorker = async (): Promise<void> => {
  while (true) {
    try {
      const messages = await receiveMessagesFromIngestionQueue(BATCH_SIZE);
      
      if (!messages || messages.length === 0) {
        continue;
      }

      const batches: Array<Array<{ receiptHandle: string; body: IngestionQueueMessage }>> = [];
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


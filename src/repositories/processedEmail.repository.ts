import { ProcessedEmail } from "../models";
import sequelize from "../config/database.config";
import {
  DbWriteQueueMessage,
  AttachmentMetadata,
} from "../types/queueMessages";

export const insertProcessedEmail = async (
  message: DbWriteQueueMessage,
): Promise<number | null> => {
  const transaction = await sequelize.transaction();

  try {
    const attachmentsJson =
      message.attachments.length > 0
        ? message.attachments.reduce(
            (
              acc: Record<string, AttachmentMetadata>,
              attachment: AttachmentMetadata,
            ) => {
              acc[attachment.attachmentId] = attachment;
              return acc;
            },
            {},
          )
        : null;

    const receivedAtDate = message.receivedAt
      ? new Date(message.receivedAt)
      : null;

    const [processedEmail, created] = await ProcessedEmail.findOrCreate({
      where: {
        gmailMessageId: message.gmailMessageId,
      },
      defaults: {
        mailboxId: message.mailboxId,
        gmailMessageId: message.gmailMessageId,
        historyId: message.historyId,
        subject: message.subject || null,
        senderEmail: message.senderEmail || null,
        recipientEmail: message.recipientEmail || null,
        ccEmail: message.ccEmail || null,
        bccEmail: message.bccEmail || null,
        body: message.body || null,
        attachments: attachmentsJson,
        attachmentsCount: message.attachmentsCount,
        threadId: message.threadId || null,
        receivedAt: receivedAtDate,
        processedAt: new Date(),
      },
      transaction,
    });

    if (!created) {
      await processedEmail.update(
        {
          subject: message.subject || null,
          senderEmail: message.senderEmail || null,
          recipientEmail: message.recipientEmail || null,
          ccEmail: message.ccEmail || null,
          bccEmail: message.bccEmail || null,
          body: message.body || null,
          attachments: attachmentsJson,
          attachmentsCount: message.attachmentsCount,
          threadId: message.threadId || null,
          receivedAt: receivedAtDate,
          processedAt: new Date(),
        },
        { transaction },
      );
    }

    await transaction.commit();
    return processedEmail.id;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const batchInsertProcessedEmails = async (
  messages: DbWriteQueueMessage[],
): Promise<Array<{ id: number; gmailMessageId: string }>> => {
  const transaction = await sequelize.transaction();

  try {
    const results: Array<{ id: number; gmailMessageId: string }> = [];

    for (const message of messages) {
      try {
        const attachmentsJson =
          message.attachments.length > 0
            ? message.attachments.reduce(
                (
                  acc: Record<string, AttachmentMetadata>,
                  attachment: AttachmentMetadata,
                ) => {
                  acc[attachment.attachmentId] = attachment;
                  return acc;
                },
                {},
              )
            : null;

        const receivedAtDate = message.receivedAt
          ? new Date(message.receivedAt)
          : null;

        const [processedEmail, created] = await ProcessedEmail.findOrCreate({
          where: {
            gmailMessageId: message.gmailMessageId,
          },
          defaults: {
            mailboxId: message.mailboxId,
            gmailMessageId: message.gmailMessageId,
            historyId: message.historyId,
            subject: message.subject || null,
            senderEmail: message.senderEmail || null,
            recipientEmail: message.recipientEmail || null,
            ccEmail: message.ccEmail || null,
            bccEmail: message.bccEmail || null,
            body: message.body || null,
            attachments: attachmentsJson,
            attachmentsCount: message.attachmentsCount,
            threadId: message.threadId || null,
            receivedAt: receivedAtDate,
            processedAt: new Date(),
          },
          transaction,
        });

        if (!created) {
          await processedEmail.update(
            {
              subject: message.subject || null,
              senderEmail: message.senderEmail || null,
              recipientEmail: message.recipientEmail || null,
              ccEmail: message.ccEmail || null,
              bccEmail: message.bccEmail || null,
              body: message.body || null,
              attachments: attachmentsJson,
              attachmentsCount: message.attachmentsCount,
              threadId: message.threadId || null,
              receivedAt: receivedAtDate,
              processedAt: new Date(),
            },
            { transaction },
          );
        }

        results.push({
          id: processedEmail.id,
          gmailMessageId: processedEmail.gmailMessageId,
        });
      } catch (error) {
        continue;
      }
    }

    await transaction.commit();
    return results;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

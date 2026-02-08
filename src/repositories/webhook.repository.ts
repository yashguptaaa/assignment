import { WebhookNotification } from "../models";
import { Op } from "sequelize";

export const insertWebhookNotification = async (
  mailboxId: string,
  gmailMessageId: string,
  historyId: string,
  payload: Record<string, unknown> | null,
): Promise<number> => {
  if (!mailboxId || !gmailMessageId || !historyId) {
    throw new Error(
      "Missing required parameters: mailboxId, gmailMessageId, or historyId",
    );
  }

  const [notification, created] = await WebhookNotification.findOrCreate({
    where: {
      mailboxId: mailboxId,
      gmailMessageId: gmailMessageId,
      historyId: historyId,
    },
    defaults: {
      mailboxId: mailboxId,
      gmailMessageId: gmailMessageId,
      historyId: historyId,
      payload,
      processedSt: "pending",
      receivedAt: new Date(),
    },
  });

  if (!created) {
    await notification.update({
      payload,
      updatedAt: new Date(),
    });
  }

  return notification.id;
};

export const checkDuplicate = async (
  mailboxId: string,
  gmailMessageId: string,
  historyId: string,
): Promise<boolean> => {
  if (!mailboxId || !gmailMessageId || !historyId) {
    throw new Error(
      "Missing required parameters: mailboxId, gmailMessageId, or historyId",
    );
  }

  const count = await WebhookNotification.count({
    where: {
      mailboxId: mailboxId,
      gmailMessageId: gmailMessageId,
      historyId: historyId,
      deletedAt: {
        [Op.is]: null,
      },
    },
  });

  return count > 0;
};

export const updateWebhookStatus = async (
  id: number,
  status: string,
  errorMessage?: string,
): Promise<void> => {
  await WebhookNotification.update(
    {
      processedSt: status,
      errorMessage: errorMessage || null,
      updatedAt: new Date(),
    },
    {
      where: { id },
    },
  );
};

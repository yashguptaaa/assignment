import { GmailMailboxConfig } from "../models";

export const getMailboxByChannelId = async (
  pubsubChannelId: string,
): Promise<GmailMailboxConfig | null> => {
  const mailbox = await GmailMailboxConfig.findOne({
    where: {
      pubsubChannelId: pubsubChannelId,
      isMailboxEnabled: true,
    },
    attributes: [
      "id",
      "mailboxId",
      "clientId",
      "userEmail",
      "pubsubChannelId",
      "isMailboxEnabled",
    ],
  });

  return mailbox;
};

export const getMailboxByMailboxId = async (
  mailboxId: string,
): Promise<GmailMailboxConfig | null> => {
  return await GmailMailboxConfig.findOne({
    where: {
      mailboxId,
      isMailboxEnabled: true,
    },
  });
};

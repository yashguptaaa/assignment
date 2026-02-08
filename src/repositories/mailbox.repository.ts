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

export const getMailboxWithCredentials = async (
  mailboxId: string,
): Promise<{
  mailboxId: string;
  clientId: string;
  userEmail: string;
  accessToken: string;
  refreshToken: string;
} | null> => {
  const mailbox = await GmailMailboxConfig.findOne({
    where: {
      mailboxId,
      isMailboxEnabled: true,
    },
    attributes: [
      "mailboxId",
      "clientId",
      "userEmail",
      "accessToken",
      "refreshToken",
    ],
  });

  if (!mailbox) {
    return null;
  }

  const mailboxIdValue = mailbox.get
    ? (mailbox.get("mailboxId") as string)
    : mailbox.mailboxId;
  const clientId = mailbox.get
    ? (mailbox.get("clientId") as string)
    : mailbox.clientId;
  const userEmail = mailbox.get
    ? (mailbox.get("userEmail") as string)
    : mailbox.userEmail;
  const accessToken = mailbox.get
    ? (mailbox.get("accessToken") as string)
    : mailbox.accessToken;
  const refreshToken = mailbox.get
    ? (mailbox.get("refreshToken") as string)
    : mailbox.refreshToken;

  return {
    mailboxId: mailboxIdValue,
    clientId,
    userEmail,
    accessToken,
    refreshToken,
  };
};

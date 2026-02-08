import { Request, Response } from "express";
import { PubSubNotification } from "../types/gmail";
import { getMailboxByChannelId } from "../repositories/mailbox.repository";
import {
  insertWebhookNotification,
  checkDuplicate,
} from "../repositories/webhook.repository";
import { sendToIngestionQueue } from "../services/sqs.service";

interface DecodedMessage {
  emailAddress?: string;
  historyId?: string;
}

const decodeBase64 = (data: string): string => {
  return Buffer.from(data, "base64").toString("utf-8");
};

const extractGmailMessageId = (
  historyId: string,
  emailAddress: string,
): string => {
  return `${emailAddress}-${historyId}`;
};

export const handleGmailWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const notification = req.body as PubSubNotification;

    if (!notification.message || !notification.message.data) {
      res.status(400).json({ error: "Invalid Pub/Sub message format" });
      return;
    }

    const pubsubChannelId =
      notification.message.attributes?.["googclient_channelid"];
    if (!pubsubChannelId || typeof pubsubChannelId !== "string") {
      res
        .status(400)
        .json({ error: "Missing pubsub_channel_id in message attributes" });
      return;
    }

    const mailbox = await getMailboxByChannelId(pubsubChannelId);
    if (!mailbox) {
      res.status(404).json({ error: "Mailbox not found for channel ID" });
      return;
    }

    const mailboxId = mailbox.get
      ? (mailbox.get("mailboxId") as string)
      : mailbox.mailboxId;
    if (!mailboxId || typeof mailboxId !== "string") {
      res.status(500).json({ error: "Mailbox ID not found in mailbox record" });
      return;
    }

    let decodedData: DecodedMessage;
    try {
      const decodedString = decodeBase64(notification.message.data);
      decodedData = JSON.parse(decodedString);
    } catch (error) {
      res.status(400).json({ error: "Failed to decode message data" });
      return;
    }

    if (!decodedData.historyId) {
      res.status(400).json({ error: "Missing historyId in decoded message" });
      return;
    }

    const emailAddress = decodedData.emailAddress || mailbox.userEmail;
    const historyId = decodedData.historyId;
    const gmailMessageId = extractGmailMessageId(historyId, emailAddress);

    const isDuplicate = await checkDuplicate(
      mailboxId,
      gmailMessageId,
      historyId,
    );
    if (isDuplicate) {
      res.status(200).json({ message: "Duplicate notification ignored" });
      return;
    }

    let webhookNotificationId: number;
    try {
      webhookNotificationId = await insertWebhookNotification(
        mailboxId,
        gmailMessageId,
        historyId,
        {
          ...decodedData,
          pubsubMessageId: notification.message.messageId,
          publishTime: notification.message.publishTime,
        },
      );
    } catch (insertError) {
      const errorMessage =
        insertError instanceof Error ? insertError.message : "Unknown error";
      res.status(500).json({
        error: "Failed to create webhook notification",
        details: errorMessage,
      });
      return;
    }

    if (!webhookNotificationId || typeof webhookNotificationId !== "number") {
      res.status(500).json({
        error: "Failed to create webhook notification",
        details: `Invalid notification ID: ${webhookNotificationId}`,
      });
      return;
    }

    let sqsError = null;
    try {
      await sendToIngestionQueue({
        mailboxId: mailboxId,
        gmailMessageId,
        historyId,
        webhookNotificationId,
      });
    } catch (sqsErr) {
      sqsError = sqsErr instanceof Error ? sqsErr.message : "Unknown error";
      console.error("Failed to send to ingestion queue:", sqsError);
    }

    const responsePayload: {
      message: string;
      webhookNotificationId: number;
      warning?: string;
      sqsError?: string;
    } = {
      message: "Webhook processed successfully",
      webhookNotificationId: webhookNotificationId,
    };

    if (sqsError) {
      responsePayload.warning = `Failed to send to ingestion queue`;
      responsePayload.sqsError = sqsError;
    }

    res.status(200).json(responsePayload);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMessage });
  }
};

export interface IngestionQueueMessage {
  mailboxId: string;
  gmailMessageId: string;
  historyId: string;
  webhookNotificationId: number;
}

export interface ProcessingQueueMessage {
  mailboxId: string;
  gmailMessageId: string;
  historyId: string;
  emailMetadata: {
    subject?: string;
    sender?: string;
    recipients?: string[];
    cc?: string[];
    bcc?: string[];
    body?: string;
    threadId?: string;
    receivedAt: string;
  };
  attachmentIds?: Array<{
    attachmentId: string;
    filename: string;
    mimeType: string;
    size: number;
  }>;
  webhookNotificationId: number;
}

export interface DbWriteQueueMessage {
  mailboxId: string;
  gmailMessageId: string;
  historyId: string;
  subject?: string;
  senderEmail?: string;
  recipientEmail?: string;
  ccEmail?: string;
  bccEmail?: string;
  body?: string;
  attachments: AttachmentMetadata[];
  attachmentsCount: number;
  threadId?: string;
  receivedAt: string;
  webhookNotificationId: number;
}

export interface AttachmentMetadata {
  filename: string;
  contentType: string;
  size: number;
  s3Key: string;
  attachmentId: string;
}

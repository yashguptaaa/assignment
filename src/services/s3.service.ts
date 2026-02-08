import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";

const getS3Client = (): S3Client => {
  const region = process.env.AWS_REGION;
  if (!region || region.trim() === "") {
    throw new Error("AWS_REGION environment variable is not set or is empty");
  }

  const credentials =
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined;

  return new S3Client({
    region: region.trim(),
    ...(credentials && { credentials }),
  });
};

export const uploadAttachmentToS3 = async (
  bucket: string,
  key: string,
  body: Buffer | Readable,
  contentType: string,
  contentLength?: number,
): Promise<string> => {
  const s3Client = getS3Client();

  const params: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ...(contentLength && { ContentLength: contentLength }),
  };

  await s3Client.send(new PutObjectCommand(params));

  return `s3://${bucket}/${key}`;
};

export const generateS3Key = (
  mailboxId: string,
  gmailMessageId: string,
  attachmentId: string,
  filename: string,
): string => {
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Date.now();
  return `received-email-attachments/${mailboxId}/${gmailMessageId}/${attachmentId}_${timestamp}_${sanitizedFilename}`;
};

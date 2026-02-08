import {
  SQSClient,
  SendMessageCommand,
  SendMessageCommandInput,
} from "@aws-sdk/client-sqs";
import { IngestionQueueMessage } from "../types/queueMessages";

const getSQSClient = (): SQSClient => {
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

  return new SQSClient({
    region: region.trim(),
    ...(credentials && { credentials }),
  });
};

export const sendToIngestionQueue = async (
  message: IngestionQueueMessage,
): Promise<void> => {
  const queueUrl = process.env.SQS_INGESTION_QUEUE_URL;
  if (!queueUrl || queueUrl.trim() === "") {
    throw new Error(
      "SQS_INGESTION_QUEUE_URL environment variable is not set or is empty",
    );
  }

  const sqsClient = getSQSClient();

  const params: SendMessageCommandInput = {
    QueueUrl: queueUrl.trim(),
    MessageBody: JSON.stringify(message),
    MessageGroupId: message.mailboxId,
    MessageDeduplicationId: `${message.mailboxId}-${message.gmailMessageId}-${message.historyId}`,
  };

  await sqsClient.send(new SendMessageCommand(params));
};

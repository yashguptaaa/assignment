import {
  SQSClient,
  SendMessageCommand,
  SendMessageCommandInput,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ReceiveMessageCommandInput,
} from "@aws-sdk/client-sqs";
import {
  IngestionQueueMessage,
  ProcessingQueueMessage,
  DbWriteQueueMessage,
} from "../types/queueMessages";

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

export const sendToProcessingQueue = async (
  message: ProcessingQueueMessage,
): Promise<void> => {
  const queueUrl = process.env.SQS_PROCESSING_QUEUE_URL;
  if (!queueUrl || queueUrl.trim() === "") {
    throw new Error(
      "SQS_PROCESSING_QUEUE_URL environment variable is not set or is empty",
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

export const receiveMessagesFromIngestionQueue = async (
  maxMessages: number = 10,
): Promise<Array<{
  receiptHandle: string;
  body: IngestionQueueMessage;
}> | null> => {
  const queueUrl = process.env.SQS_INGESTION_QUEUE_URL;
  if (!queueUrl || queueUrl.trim() === "") {
    throw new Error(
      "SQS_INGESTION_QUEUE_URL environment variable is not set or is empty",
    );
  }

  const sqsClient = getSQSClient();

  const params: ReceiveMessageCommandInput = {
    QueueUrl: queueUrl.trim(),
    MaxNumberOfMessages: Math.min(maxMessages, 10),
    WaitTimeSeconds: 20,
    MessageAttributeNames: ["All"],
  };

  const response = await sqsClient.send(new ReceiveMessageCommand(params));

  if (!response.Messages || response.Messages.length === 0) {
    return null;
  }

  return response.Messages.map((msg) => {
    if (!msg.Body || !msg.ReceiptHandle) {
      throw new Error("Invalid message format from SQS");
    }
    return {
      receiptHandle: msg.ReceiptHandle,
      body: JSON.parse(msg.Body) as IngestionQueueMessage,
    };
  });
};

export const deleteMessageFromIngestionQueue = async (
  receiptHandle: string,
): Promise<void> => {
  const queueUrl = process.env.SQS_INGESTION_QUEUE_URL;
  if (!queueUrl || queueUrl.trim() === "") {
    throw new Error(
      "SQS_INGESTION_QUEUE_URL environment variable is not set or is empty",
    );
  }

  const sqsClient = getSQSClient();

  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl.trim(),
      ReceiptHandle: receiptHandle,
    }),
  );
};

export const receiveMessagesFromProcessingQueue = async (
  maxMessages: number = 10,
): Promise<Array<{
  receiptHandle: string;
  body: ProcessingQueueMessage;
}> | null> => {
  const queueUrl = process.env.SQS_PROCESSING_QUEUE_URL;
  if (!queueUrl || queueUrl.trim() === "") {
    throw new Error(
      "SQS_PROCESSING_QUEUE_URL environment variable is not set or is empty",
    );
  }

  const sqsClient = getSQSClient();

  const params: ReceiveMessageCommandInput = {
    QueueUrl: queueUrl.trim(),
    MaxNumberOfMessages: Math.min(maxMessages, 10),
    WaitTimeSeconds: 20,
    MessageAttributeNames: ["All"],
  };

  const response = await sqsClient.send(new ReceiveMessageCommand(params));

  if (!response.Messages || response.Messages.length === 0) {
    return null;
  }

  return response.Messages.map((msg) => {
    if (!msg.Body || !msg.ReceiptHandle) {
      throw new Error("Invalid message format from SQS");
    }
    return {
      receiptHandle: msg.ReceiptHandle,
      body: JSON.parse(msg.Body) as ProcessingQueueMessage,
    };
  });
};

export const deleteMessageFromProcessingQueue = async (
  receiptHandle: string,
): Promise<void> => {
  const queueUrl = process.env.SQS_PROCESSING_QUEUE_URL;
  if (!queueUrl || queueUrl.trim() === "") {
    throw new Error(
      "SQS_PROCESSING_QUEUE_URL environment variable is not set or is empty",
    );
  }

  const sqsClient = getSQSClient();

  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl.trim(),
      ReceiptHandle: receiptHandle,
    }),
  );
};

export const sendToDbWriteQueue = async (
  message: DbWriteQueueMessage,
): Promise<void> => {
  const queueUrl = process.env.SQS_DB_WRITE_QUEUE_URL;
  if (!queueUrl || queueUrl.trim() === "") {
    throw new Error(
      "SQS_DB_WRITE_QUEUE_URL environment variable is not set or is empty",
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

export const receiveMessagesFromDbWriteQueue = async (
  maxMessages: number = 10,
): Promise<Array<{
  receiptHandle: string;
  body: DbWriteQueueMessage;
}> | null> => {
  const queueUrl = process.env.SQS_DB_WRITE_QUEUE_URL;
  if (!queueUrl || queueUrl.trim() === "") {
    throw new Error(
      "SQS_DB_WRITE_QUEUE_URL environment variable is not set or is empty",
    );
  }

  const sqsClient = getSQSClient();

  const params: ReceiveMessageCommandInput = {
    QueueUrl: queueUrl.trim(),
    MaxNumberOfMessages: Math.min(maxMessages, 10),
    WaitTimeSeconds: 20,
    MessageAttributeNames: ["All"],
  };

  const response = await sqsClient.send(new ReceiveMessageCommand(params));

  if (!response.Messages || response.Messages.length === 0) {
    return null;
  }

  return response.Messages.map((msg) => {
    if (!msg.Body || !msg.ReceiptHandle) {
      throw new Error("Invalid message format from SQS");
    }
    return {
      receiptHandle: msg.ReceiptHandle,
      body: JSON.parse(msg.Body) as DbWriteQueueMessage,
    };
  });
};

export const deleteMessageFromDbWriteQueue = async (
  receiptHandle: string,
): Promise<void> => {
  const queueUrl = process.env.SQS_DB_WRITE_QUEUE_URL;
  if (!queueUrl || queueUrl.trim() === "") {
    throw new Error(
      "SQS_DB_WRITE_QUEUE_URL environment variable is not set or is empty",
    );
  }

  const sqsClient = getSQSClient();

  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl.trim(),
      ReceiptHandle: receiptHandle,
    }),
  );
};

export const receiveMessagesFromDLQ = async (
  maxMessages: number = 10,
): Promise<Array<{
  receiptHandle: string;
  body: unknown;
  attributes?: Record<string, string>;
}> | null> => {
  const queueUrl = process.env.SQS_DLQ_URL;
  if (!queueUrl || queueUrl.trim() === "") {
    throw new Error("SQS_DLQ_URL environment variable is not set or is empty");
  }

  const sqsClient = getSQSClient();

  const params: ReceiveMessageCommandInput = {
    QueueUrl: queueUrl.trim(),
    MaxNumberOfMessages: Math.min(maxMessages, 10),
    WaitTimeSeconds: 20,
    MessageAttributeNames: ["All"],
  };

  const response = await sqsClient.send(new ReceiveMessageCommand(params));

  if (!response.Messages || response.Messages.length === 0) {
    return null;
  }

  return response.Messages.map((msg) => {
    if (!msg.Body || !msg.ReceiptHandle) {
      throw new Error("Invalid message format from SQS");
    }
    return {
      receiptHandle: msg.ReceiptHandle,
      body: JSON.parse(msg.Body),
      attributes: msg.Attributes || {},
    };
  });
};

export const deleteMessageFromDLQ = async (
  receiptHandle: string,
): Promise<void> => {
  const queueUrl = process.env.SQS_DLQ_URL;
  if (!queueUrl || queueUrl.trim() === "") {
    throw new Error("SQS_DLQ_URL environment variable is not set or is empty");
  }

  const sqsClient = getSQSClient();

  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl.trim(),
      ReceiptHandle: receiptHandle,
    }),
  );
};

import {
  IngestionQueueMessage,
  ProcessingQueueMessage,
  DbWriteQueueMessage,
} from "./queueMessages";

export type DLQMessage =
  | IngestionQueueMessage
  | ProcessingQueueMessage
  | DbWriteQueueMessage;

export interface DLQMessageWithMetadata {
  message: DLQMessage;
  originalQueue: "ingestion" | "processing" | "db-write";
  failureCount: number;
  firstFailureAt: string;
  lastFailureAt: string;
  errorMessage?: string;
}

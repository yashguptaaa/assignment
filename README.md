# Email Processing Service

A high-throughput, production-grade email ingestion and processing system built with TypeScript, Node.js, Express, PostgreSQL, AWS SQS, and AWS S3. This system processes Gmail notifications via Pub/Sub webhooks, fetches email metadata and attachments, and stores processed data in PostgreSQL with attachments stored in S3.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [AWS Setup](#aws-setup)
- [Running the Services](#running-the-services)
- [API Endpoints](#api-endpoints)
- [Workers](#workers)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

## Overview

This service handles the complete lifecycle of email processing:

1. **Webhook Ingestion**: Receives Gmail Pub/Sub notifications via webhook API
2. **Email Fetching**: Fetches email metadata from Gmail API
3. **Attachment Processing**: Downloads attachments and uploads to S3
4. **Database Writing**: Stores processed email data in PostgreSQL
5. **DLQ Processing**: Handles failed messages from Dead Letter Queue
6. **Query APIs**: Provides REST APIs to query processed emails

The system is designed to handle **30,000+ emails per hour** with horizontal scaling capabilities.

## Architecture

```
┌─────────────────┐
│  Gmail Pub/Sub  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Webhook API    │ ──► SQS Ingestion Queue (FIFO)
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Email Fetcher   │ ──► SQS Processing Queue (FIFO)
│    Worker       │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Attachment      │ ──► SQS DB Write Queue (FIFO)
│ Processor       │      │
│    Worker       │      │
└─────────────────┘      │
         │                │
         ▼                ▼
┌─────────────────┐  ┌──────────────┐
│   AWS S3        │  │   DB Writer  │
│  (Attachments)  │  │    Worker    │ ──► PostgreSQL
└─────────────────┘  └──────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │ DLQ Processor│
                        │    Worker    │
                        └──────────────┘
```

### Key Components

- **Webhook API**: Express.js server that receives Gmail Pub/Sub notifications
- **SQS Queues**: Four FIFO queues for message processing (Ingestion, Processing, DB Write, DLQ)
- **Workers**: Four stateless worker processes for asynchronous processing
- **PostgreSQL**: Database for storing mailbox configs, webhook notifications, and processed emails
- **AWS S3**: Storage for email attachments
- **Gmail API**: For fetching email metadata and attachments

## Features

- ✅ **High Throughput**: Designed for 30k+ emails/hour
- ✅ **Idempotency**: Duplicate detection at webhook and database levels
- ✅ **Stateless Workers**: Horizontal scaling support
- ✅ **FIFO Queues**: Message ordering and deduplication
- ✅ **Batch Processing**: Efficient database writes and SQS consumption
- ✅ **Error Handling**: DLQ for failed messages with retry logic
- ✅ **Encryption**: AES-256-GCM encryption for sensitive tokens
- ✅ **Connection Pooling**: Efficient database resource management
- ✅ **Type Safety**: Full TypeScript implementation
- ✅ **REST APIs**: Query processed emails by various filters

## Prerequisites

- **Node.js**: >= 18.0.0
- **PostgreSQL**: >= 12.0
- **AWS Account**: With SQS and S3 access
- **Gmail API Credentials**: OAuth2 client ID and secret
- **TypeScript**: Installed globally or via npm

## Installation

1. **Clone the repository** (or navigate to the project directory)

2. **Install dependencies**:

```bash
npm install
```

3. **Build the project**:

```bash
npm run build
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DB_HOST=localhost
DB_DIALECT=postgres
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_DATABASE=email_processing
DB_PORT=5432

# AWS Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
S3_BUCKET_NAME=your-s3-bucket-name

# SQS Queue URLs
SQS_INGESTION_QUEUE_URL=https://sqs.region.amazonaws.com/account-id/email-ingestion-queue.fifo
SQS_PROCESSING_QUEUE_URL=https://sqs.region.amazonaws.com/account-id/email-processing-queue.fifo
SQS_DB_WRITE_QUEUE_URL=https://sqs.region.amazonaws.com/account-id/email-db-write-queue.fifo
SQS_DLQ_URL=https://sqs.region.amazonaws.com/account-id/email-dlq.fifo

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key-here

# Server Configuration
PORT=3000

# Worker Configuration
EMAIL_FETCHER_CONCURRENCY=5
EMAIL_FETCHER_BATCH_SIZE=10
ATTACHMENT_PROCESSOR_CONCURRENCY=5
ATTACHMENT_PROCESSOR_BATCH_SIZE=10
ATTACHMENT_DOWNLOAD_CONCURRENCY=3
DB_WRITER_CONCURRENCY=3
DB_WRITER_BATCH_SIZE=25
DLQ_PROCESSOR_BATCH_SIZE=10

# Gmail OAuth Credentials
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_PROJECT_ID=your-google-cloud-project-id
GMAIL_TOPIC_NAME=gmail-notifications
```

### Generating Encryption Key

Generate a 32-character encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use the output as your `ENCRYPTION_KEY`.

## Database Setup

1. **Create PostgreSQL database**:

```sql
CREATE DATABASE email_processing;
```

2. **Run migrations**:

```bash
npm run migrate
```

This will create the following tables:

- `gmail_mailbox_config`: Stores Gmail mailbox configurations and OAuth tokens
- `webhook_notifications`: Tracks incoming webhook notifications
- `processed_emails`: Stores processed email data

3. **Insert test mailbox** (optional, for testing):

```sql
INSERT INTO gmail_mailbox_config (
  mailbox_id,
  client_id,
  user_email,
  access_token,
  refresh_token,
  pubsub_channel_id,
  pubsub_topic_name,
  token_expiry,
  is_mailbox_enabled,
  created_at,
  updated_at
) VALUES (
  'test-mailbox-001',
  'your-client-id',
  'test@example.com',
  'encrypted-access-token',
  'encrypted-refresh-token',
  'test-channel-id-123',
  'gmail-notifications',
  '2025-12-31 23:59:59'::timestamp,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
```

**Note**: Access tokens and refresh tokens should be encrypted using the encryption service before inserting into the database.

## AWS Setup

### 1. Create SQS Queues

Create four FIFO queues in AWS SQS:

- `email-ingestion-queue.fifo`
- `email-processing-queue.fifo`
- `email-db-write-queue.fifo`
- `email-dlq.fifo`

**Queue Configuration**:

- **Type**: FIFO
- **Content-based deduplication**: Enabled (or use MessageDeduplicationId)
- **Visibility timeout**: 30 seconds (adjust based on processing time)
- **Message retention**: 14 days
- **Redrive policy**: Set DLQ as dead letter queue with max receive count = 3

### 2. Create S3 Bucket

Create an S3 bucket for storing attachments:

- **Bucket name**: As specified in `S3_BUCKET_NAME`
- **Region**: Same as `AWS_REGION`
- **Versioning**: Optional (recommended for production)

### 3. Configure IAM Permissions

Attach IAM policies to your AWS user/role with the following permissions:

**SQS Permissions**:

- `sqs:SendMessage`
- `sqs:ReceiveMessage`
- `sqs:DeleteMessage`
- `sqs:GetQueueAttributes`
- `sqs:GetQueueUrl`

**S3 Permissions**:

- `s3:PutObject` (on `received-email-attachments/*`)
- `s3:GetObject` (on `received-email-attachments/*`)
- `s3:DeleteObject` (on `received-email-attachments/*`)
- `s3:ListBucket`

See `AWS_CONSOLE_SETUP.md` for detailed step-by-step instructions.

## Running the Services

### 1. Start the Webhook API Server

```bash
npm run dev
```

The server will start on `http://localhost:3000` (or the port specified in `PORT`).

**Health Check**:

```bash
curl http://localhost:3000/health
```

### 2. Start the Workers

Run each worker in a separate terminal or process:

**Email Fetcher Worker**:

```bash
npm run worker:email-fetcher
```

**Attachment Processor Worker**:

```bash
npm run worker:attachment-processor
```

**DB Writer Worker**:

```bash
npm run worker:db-writer
```

**DLQ Processor Worker**:

```bash
npm run worker:dlq-processor
```

**Note**: In production, use process managers like PM2, systemd, or container orchestration to run multiple worker instances.

### 3. Production Build

For production, build and run:

```bash
npm run build
npm start
```

## API Endpoints

### Webhook API

#### `POST /webhook/gmail`

Receives Gmail Pub/Sub notifications.

**Request Body**:

```json
{
  "message": {
    "data": "base64-encoded-json",
    "messageId": "message-id",
    "publishTime": "2024-01-01T00:00:00Z",
    "attributes": {
      "googclient_channelid": "channel-id"
    }
  }
}
```

**Response** (200 OK):

```json
{
  "message": "Webhook processed successfully",
  "webhookNotificationId": 123
}
```

### Email Query APIs

#### `GET /emails`

List processed emails with optional filters.

**Query Parameters**:

- `mailboxId` (optional): Filter by mailbox ID
- `gmailMessageId` (optional): Filter by Gmail message ID
- `threadId` (optional): Filter by thread ID
- `limit` (optional, default: 50, max: 100): Number of results
- `offset` (optional, default: 0): Pagination offset

**Example**:

```bash
curl "http://localhost:3000/emails?mailboxId=test-mailbox-001&limit=10"
```

**Response**:

```json
{
  "total": 100,
  "limit": 10,
  "offset": 0,
  "emails": [...]
}
```

#### `GET /emails/:gmailMessageId`

Get a specific processed email by Gmail message ID.

**Example**:

```bash
curl "http://localhost:3000/emails/test@example.com-1234567890"
```

#### `GET /emails/mailbox/:mailboxId`

Get all processed emails for a specific mailbox.

**Query Parameters**:

- `limit` (optional, default: 50)
- `offset` (optional, default: 0)

**Example**:

```bash
curl "http://localhost:3000/emails/mailbox/test-mailbox-001?limit=20"
```

#### `GET /emails/thread/:threadId`

Get all processed emails in a thread.

**Query Parameters**:

- `limit` (optional, default: 50)
- `offset` (optional, default: 0)

**Example**:

```bash
curl "http://localhost:3000/emails/thread/thread-123?limit=50"
```

### Health Check

#### `GET /health`

Check if the service is running.

**Response**:

```json
{
  "status": "ok"
}
```

## Workers

### Email Fetcher Worker

- **Queue**: Ingestion Queue
- **Function**: Fetches email metadata from Gmail API
- **Output**: Sends messages to Processing Queue
- **Configuration**: `EMAIL_FETCHER_CONCURRENCY`, `EMAIL_FETCHER_BATCH_SIZE`

### Attachment Processor Worker

- **Queue**: Processing Queue
- **Function**: Downloads attachments from Gmail and uploads to S3
- **Output**: Sends messages to DB Write Queue
- **Configuration**: `ATTACHMENT_PROCESSOR_CONCURRENCY`, `ATTACHMENT_PROCESSOR_BATCH_SIZE`, `ATTACHMENT_DOWNLOAD_CONCURRENCY`

### DB Writer Worker

- **Queue**: DB Write Queue
- **Function**: Writes processed email data to PostgreSQL
- **Output**: Updates webhook notification status to "completed"
- **Configuration**: `DB_WRITER_CONCURRENCY`, `DB_WRITER_BATCH_SIZE`

### DLQ Processor Worker

- **Queue**: Dead Letter Queue
- **Function**: Processes failed messages and updates webhook status to "failed"
- **Output**: Deletes messages from DLQ after processing
- **Configuration**: `DLQ_PROCESSOR_BATCH_SIZE`

## Testing

### End-to-End Testing

Run the complete end-to-end test:

```bash
npm run test:e2e
```

This tests the entire flow from webhook ingestion to database storage.

### Layer-by-Layer Testing

Test individual layers:

```bash
npm run test:layer 1  # Webhook API
npm run test:layer 2  # Ingestion Queue
npm run test:layer 3  # Processing Queue
npm run test:layer 4  # DB Write Queue
npm run test:layer 5  # Database
npm run test:layer 6  # Query APIs
npm run test:layer 7  # DLQ
```

### Load Testing

Test high-throughput scenarios:

```bash
npm run load-test
```

This will generate and send 30,000 webhook notifications to test the system's capacity.

### Clear In-Flight Messages

If messages are stuck in queues (in-flight), clear them:

```bash
npm run queue:clear ingestion
npm run queue:clear processing
npm run queue:clear db-write
```

## Project Structure

```
email-processing-service/
├── src/
│   ├── api/                    # API controllers and routes
│   │   ├── webhook.controller.ts
│   │   ├── webhook.routes.ts
│   │   ├── emails.controller.ts
│   │   └── emails.routes.ts
│   ├── config/                 # Configuration files
│   │   ├── database.ts         # Sequelize connection
│   │   └── database.config.ts  # Sequelize CLI config
│   ├── models/                 # Sequelize models
│   │   ├── GmailMailboxConfig.ts
│   │   ├── WebhookNotification.ts
│   │   ├── ProcessedEmail.ts
│   │   └── index.ts
│   ├── migrations/             # Database migrations
│   │   ├── 20240101000001-create-gmail-mailbox-config.ts
│   │   ├── 20240101000002-create-webhook-notifications.ts
│   │   └── 20240101000003-create-processed-emails.ts
│   ├── repositories/           # Database access layer
│   │   ├── mailbox.repository.ts
│   │   ├── webhook.repository.ts
│   │   └── processedEmail.repository.ts
│   ├── services/               # Business logic services
│   │   ├── encryption.service.ts
│   │   ├── gmail.service.ts
│   │   ├── s3.service.ts
│   │   └── sqs.service.ts
│   ├── types/                   # TypeScript type definitions
│   │   ├── gmail.ts
│   │   ├── queueMessages.ts
│   │   └── dlqMessages.ts
│   ├── workers/                 # Worker processes
│   │   ├── emailFetcher.worker.ts
│   │   ├── attachmentProcessor.worker.ts
│   │   ├── dbWriter.worker.ts
│   │   └── dlqProcessor.worker.ts
│   └── index.ts                 # Application entry point
├── dist/                        # Compiled JavaScript (generated)
├── test-e2e.js                  # End-to-end test script
├── test-layer-by-layer.js       # Layer-by-layer test script
├── load-test-30k.js             # Load testing script
├── get-gmail-tokens.js          # Gmail OAuth token helper
├── setup-gmail-watch.js         # Gmail watch setup helper
├── delete-inflight-messages.js  # Queue cleanup utility
├── package.json
├── tsconfig.json
├── .sequelizerc                 # Sequelize CLI configuration
└── README.md
```

## Troubleshooting

### Database Connection Issues

**Error**: `Dialect needs to be explicitly supplied`

**Solution**: Ensure `DB_DIALECT=postgres` is set in `.env`.

**Error**: `Connection timeout`

**Solution**: Check `DB_HOST`, `DB_PORT`, and database credentials. Ensure PostgreSQL is running and accessible.

### SQS Issues

**Error**: `Credential should be scoped to a valid region`

**Solution**: Ensure `AWS_REGION` is set correctly in `.env`.

**Error**: `Access Denied` when sending/receiving messages

**Solution**: Check IAM permissions. Ensure your AWS credentials have the required SQS permissions.

### Worker Issues

**Messages stuck in queue (in-flight)**

**Solution**:

1. Check worker logs for errors
2. Stop workers and wait for visibility timeout
3. Use `npm run queue:clear <queue-name>` to force-clear messages

**Worker not processing messages**

**Solution**:

1. Verify queue URLs in `.env`
2. Check AWS credentials
3. Ensure workers are running: `ps aux | grep worker`

### Gmail API Issues

**Error**: `Invalid initialization vector`

**Solution**: Ensure tokens are properly encrypted. Use the encryption service to encrypt tokens before storing in database.

**Error**: `401 Unauthorized`

**Solution**:

1. Check if access token is expired
2. Refresh the token using `npm run gmail:tokens`
3. Update the database with new encrypted tokens

### Webhook Issues

**Error**: `Mailbox not found for channel ID`

**Solution**: Ensure the mailbox is configured in `gmail_mailbox_config` table with the correct `pubsub_channel_id`.

**Error**: `Failed to decode message data`

**Solution**: Ensure the webhook payload is properly base64 encoded. Check Gmail Pub/Sub message format.

## Additional Resources

- **End-to-End Testing Guide**: See `END_TO_END_TESTING.md`
- **Webhook Testing Guide**: See `TESTING_WEBHOOK.md`
- **AWS Setup Guide**: See `AWS_CONSOLE_SETUP.md`
- **Real Gmail Setup**: See `REAL_GMAIL_SETUP.md`

## License

This project is proprietary software. All rights reserved.

## Support

For issues and questions, please contact the development team.

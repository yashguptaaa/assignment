#!/bin/bash

# Generate a unique webhook payload with a new historyId
# Usage: ./generate-unique-payload.sh

BASE_URL="${BASE_URL:-http://localhost:3000}"
CHANNEL_ID="${CHANNEL_ID:-test-channel-id-123}"
EMAIL="${EMAIL:-test@example.com}"

# Generate unique historyId (timestamp in milliseconds)
HISTORY_ID=$(date +%s)000

# Create the JSON payload and encode to base64 (remove newlines)
JSON_PAYLOAD="{\"emailAddress\":\"$EMAIL\",\"historyId\":\"$HISTORY_ID\"}"
BASE64_DATA=$(echo -n "$JSON_PAYLOAD" | base64 | tr -d '\n')

# Generate unique messageId
MESSAGE_ID="test-message-id-$(date +%s)"
PUBLISH_TIME=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)

echo "=========================================="
echo "Unique Webhook Payload Generator"
echo "=========================================="
echo ""
echo "History ID: $HISTORY_ID"
echo "Base64 Data: $BASE64_DATA"
echo "Decoded Data: $JSON_PAYLOAD"
echo ""
echo "=========================================="
echo "cURL Command:"
echo "=========================================="
echo ""
echo "curl -X POST $BASE_URL/webhook/gmail \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{"
echo "    \"message\": {"
echo "      \"data\": \"$BASE64_DATA\","
echo "      \"messageId\": \"$MESSAGE_ID\","
echo "      \"publishTime\": \"$PUBLISH_TIME\","
echo "      \"attributes\": {"
echo "        \"googclient_channelid\": \"$CHANNEL_ID\""
echo "      }"
echo "    },"
echo "    \"subscription\": \"projects/test-project/subscriptions/test-subscription\""
echo "  }'"
echo ""


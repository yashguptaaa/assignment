import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

interface GmailMessagePart {
  mimeType: string;
  filename?: string;
  body: { attachmentId?: string; data?: string; size?: number };
  parts?: GmailMessagePart[];
}

interface GmailMessagePayload {
  headers: Array<{ name: string; value: string }>;
  parts?: GmailMessagePart[];
  body?: { data?: string; size?: number };
  mimeType?: string;
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: GmailMessagePayload;
}

interface EmailMetadata {
  subject?: string;
  sender?: string;
  recipients?: string[];
  cc?: string[];
  bcc?: string[];
  body?: string;
  threadId?: string;
  receivedAt: string;
  attachmentIds: Array<{
    attachmentId: string;
    filename: string;
    mimeType: string;
    size: number;
  }>;
}

const getOAuth2Client = (
  clientId: string,
  accessToken: string,
  refreshToken: string,
): OAuth2Client => {
  const oauth2Client = new OAuth2Client(clientId);
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return oauth2Client;
};

const refreshAccessToken = async (
  oauth2Client: OAuth2Client,
  refreshToken: string,
): Promise<string> => {
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  if (!credentials.access_token) {
    throw new Error("Failed to refresh access token");
  }
  return credentials.access_token;
};

const getHeaderValue = (
  headers: Array<{ name: string; value: string }>,
  name: string,
): string | undefined => {
  const header = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  );
  return header?.value;
};

const parseEmailAddresses = (value?: string): string[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((addr) => addr.trim())
    .filter(Boolean);
};

const extractBody = (payload: GmailMessagePayload): string => {
  let bodyText = "";
  let bodyHtml = "";

  const extractFromPart = (part: GmailMessagePart): void => {
    if (part.mimeType === "text/plain" && part.body?.data) {
      bodyText = Buffer.from(part.body.data, "base64").toString("utf-8");
    } else if (part.mimeType === "text/html" && part.body?.data) {
      bodyHtml = Buffer.from(part.body.data, "base64").toString("utf-8");
    }

    if (part.parts) {
      part.parts.forEach(extractFromPart);
    }
  };

  if (payload.parts) {
    payload.parts.forEach(extractFromPart);
  } else if (payload.body?.data) {
    const mimeType = payload.mimeType || "text/plain";
    const decoded = Buffer.from(payload.body.data, "base64").toString("utf-8");
    if (mimeType === "text/html") {
      bodyHtml = decoded;
    } else {
      bodyText = decoded;
    }
  }

  return bodyHtml || bodyText;
};

const extractAttachments = (
  payload: GmailMessagePayload,
): Array<{
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}> => {
  const attachments: Array<{
    attachmentId: string;
    filename: string;
    mimeType: string;
    size: number;
  }> = [];

  const extractFromPart = (part: GmailMessagePart): void => {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body.size || 0,
      });
    }

    if (part.parts) {
      part.parts.forEach(extractFromPart);
    }
  };

  if (payload.parts) {
    payload.parts.forEach(extractFromPart);
  }

  return attachments;
};

export const fetchEmailMetadata = async (
  clientId: string,
  accessToken: string,
  refreshToken: string,
  messageId: string,
): Promise<EmailMetadata> => {
  const oauth2Client = getOAuth2Client(clientId, accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  try {
    const response = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const message = response.data as GmailMessage;
    const headers = message.payload.headers;

    const subject = getHeaderValue(headers, "Subject");
    const from = getHeaderValue(headers, "From");
    const to = getHeaderValue(headers, "To");
    const cc = getHeaderValue(headers, "Cc");
    const bcc = getHeaderValue(headers, "Bcc");
    const date = getHeaderValue(headers, "Date");

    const body = extractBody(message.payload);
    const attachmentIds = extractAttachments(message.payload);

    return {
      subject,
      sender: from,
      recipients: parseEmailAddresses(to),
      cc: parseEmailAddresses(cc),
      bcc: parseEmailAddresses(bcc),
      body,
      threadId: message.threadId,
      receivedAt:
        date || new Date(parseInt(message.internalDate)).toISOString(),
      attachmentIds,
    };
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 401
    ) {
      const newAccessToken = await refreshAccessToken(
        oauth2Client,
        refreshToken,
      );
      oauth2Client.setCredentials({ access_token: newAccessToken });
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      const response = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      });

      const message = response.data as GmailMessage;
      const headers = message.payload.headers;

      const subject = getHeaderValue(headers, "Subject");
      const from = getHeaderValue(headers, "From");
      const to = getHeaderValue(headers, "To");
      const cc = getHeaderValue(headers, "Cc");
      const bcc = getHeaderValue(headers, "Bcc");
      const date = getHeaderValue(headers, "Date");

      const body = extractBody(message.payload);
      const attachmentIds = extractAttachments(message.payload);

      return {
        subject,
        sender: from,
        recipients: parseEmailAddresses(to),
        cc: parseEmailAddresses(cc),
        bcc: parseEmailAddresses(bcc),
        body,
        threadId: message.threadId,
        receivedAt:
          date || new Date(parseInt(message.internalDate)).toISOString(),
        attachmentIds,
      };
    }
    throw error;
  }
};

export const getMessageIdFromHistoryId = async (
  clientId: string,
  accessToken: string,
  refreshToken: string,
  historyId: string,
): Promise<string | null> => {
  const oauth2Client = getOAuth2Client(clientId, accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  try {
    const response = await gmail.users.history.list({
      userId: "me",
      startHistoryId: historyId,
      historyTypes: ["messageAdded"],
      maxResults: 1,
    });

    const history = response.data.history;
    if (
      history &&
      history.length > 0 &&
      history[0].messagesAdded &&
      history[0].messagesAdded.length > 0
    ) {
      return history[0].messagesAdded[0].message?.id || null;
    }

    return null;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 401
    ) {
      const newAccessToken = await refreshAccessToken(
        oauth2Client,
        refreshToken,
      );
      oauth2Client.setCredentials({ access_token: newAccessToken });

      const response = await gmail.users.history.list({
        userId: "me",
        startHistoryId: historyId,
        historyTypes: ["messageAdded"],
        maxResults: 1,
      });

      const history = response.data.history;
      if (
        history &&
        history.length > 0 &&
        history[0].messagesAdded &&
        history[0].messagesAdded.length > 0
      ) {
        return history[0].messagesAdded[0].message?.id || null;
      }

      return null;
    }
    throw error;
  }
};

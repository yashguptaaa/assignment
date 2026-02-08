import * as crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

const getKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  return crypto.scryptSync(key, "salt", 32);
};

export const encrypt = (text: string): string => {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]).toString("base64");
};

export const decrypt = (encryptedData: string): string => {
  const looksLikeEncrypted =
    encryptedData.length > 100 && /^[A-Za-z0-9+/=]+$/.test(encryptedData);

  if (!looksLikeEncrypted) {
    return encryptedData;
  }

  try {
    const key = getKey();
    const data = Buffer.from(encryptedData, "base64");

    const minEncryptedLength = SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1;
    if (data.length < minEncryptedLength) {
      return encryptedData;
    }

    const iv = data.subarray(SALT_LENGTH, TAG_POSITION);
    const tag = data.subarray(TAG_POSITION, ENCRYPTED_POSITION);
    const encrypted = data.subarray(ENCRYPTED_POSITION);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    return decipher.update(encrypted) + decipher.final("utf8");
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("initialization vector")
    ) {
      return encryptedData;
    }
    throw error;
  }
};

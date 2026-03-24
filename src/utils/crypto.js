import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const ENCRYPTION_KEY = process.env.MESSAGE_ENCRYPTION_KEY; // Must be 32 bytes (64 hex characters)
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a string using AES-256-GCM
 * @param {string} text Plain text to encrypt
 * @returns {string} Encrypted string in format: iv:authTag:encryptedContent
 */
export const encrypt = (text) => {
  if (!text) return "";
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    console.warn("Encryption key not found or invalid. Returning plain text.");
    return text;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"), iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag().toString("hex");
  
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
};

/**
 * Decrypts a string using AES-256-GCM
 * @param {string} encryptedText Encrypted string in format: iv:authTag:encryptedContent
 * @returns {string} Decrypted plain text
 */
export const decrypt = (encryptedText) => {
  if (!encryptedText) return "";
  
  // If it's not in our format (doesn't contain colons), it's likely old plain text
  if (!encryptedText.includes(":")) return encryptedText;

  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    console.warn("Encryption key not found or invalid. Cannot decrypt.");
    return "[Encrypted Message]";
  }

  try {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(":");
    
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"), iv);
    
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error);
    return "[Decryption Error]";
  }
};

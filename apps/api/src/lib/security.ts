import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { customAlphabet } from "nanoid";

const otpAlphabet = customAlphabet("0123456789", 6);
const recoveryAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+7") && digits.length === 11 && digits.startsWith("8")) {
    return `+7${digits.slice(1)}`;
  }
  return digits;
}

export function generateOtpCode(): string {
  return otpAlphabet();
}

export function generateRecoveryCode(): string {
  return recoveryAlphabet();
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function randomToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export function deviceHash(seed: string): string {
  return sha256(seed);
}

export function nowPlusSeconds(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}

export function nowPlusDays(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

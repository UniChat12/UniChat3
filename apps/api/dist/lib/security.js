import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { customAlphabet } from "nanoid";
const otpAlphabet = customAlphabet("0123456789", 6);
const recoveryAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);
export function normalizePhone(phone) {
    const digits = phone.replace(/[^\d+]/g, "");
    if (!digits.startsWith("+7") && digits.length === 11 && digits.startsWith("8")) {
        return `+7${digits.slice(1)}`;
    }
    return digits;
}
export function generateOtpCode() {
    return otpAlphabet();
}
export function generateRecoveryCode() {
    return recoveryAlphabet();
}
export function sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
}
export async function hashPassword(password) {
    return bcrypt.hash(password, 12);
}
export async function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
}
export function randomToken() {
    return crypto.randomBytes(48).toString("base64url");
}
export function deviceHash(seed) {
    return sha256(seed);
}
export function nowPlusSeconds(seconds) {
    return new Date(Date.now() + seconds * 1000);
}
export function nowPlusDays(days) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

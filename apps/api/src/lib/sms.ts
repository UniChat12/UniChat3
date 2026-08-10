import { env } from "../config.js";

export type SmsSendResult = {
  provider: "mock" | "smsru";
  accepted: boolean;
  messageId?: string;
};

export async function sendOtpSms(phone: string, code: string): Promise<SmsSendResult> {
  if (env.SMS_PROVIDER === "mock") {
    console.log(`[MOCK_SMS] phone=${phone} code=${code}`);
    return {
      provider: "mock",
      accepted: true,
      messageId: `mock-${Date.now()}`
    };
  }

  // Placeholder for real provider integration (sms.ru API).
  // Keep this boundary to switch providers without touching auth logic.
  console.log(`[SMS_PLACEHOLDER] phone=${phone} code=${code}`);
  return {
    provider: "smsru",
    accepted: true,
    messageId: `smsru-placeholder-${Date.now()}`
  };
}

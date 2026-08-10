import { config as loadEnv } from "dotenv";
import { z } from "zod";
loadEnv();
const stringToBool = z
    .string()
    .default("false")
    .transform((value) => value.toLowerCase() === "true");
const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    API_PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_ACCESS_TTL: z.string().default("15m"),
    JWT_REFRESH_TTL_DAYS: z.coerce.number().default(30),
    OTP_TTL_SECONDS: z.coerce.number().default(120),
    OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
    OTP_ALLOW_ANY_CODE: stringToBool,
    SMS_PROVIDER: z.enum(["mock", "smsru"]).default("mock"),
    CLOUD_PASSWORD_MIN_LENGTH: z.coerce.number().default(10),
    MAX_IMAGE_SIZE_MB: z.coerce.number().default(10),
    ALLOWED_IMAGE_MIME: z.string().default("image/jpeg,image/png,image/webp"),
    UPLOAD_DIR: z.string().default("./uploads"),
    CORS_ORIGIN: z.string().default("http://localhost:5173")
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
    process.exit(1);
}
export const env = parsed.data;
export const allowedImageMime = env.ALLOWED_IMAGE_MIME.split(",").map((m) => m.trim());

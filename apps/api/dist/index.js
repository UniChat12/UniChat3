import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config.js";
import { prisma } from "./lib/prisma.js";
import { adminRoutes } from "./routes/admin.js";
import { attachmentRoutes } from "./routes/attachments.js";
import { authRoutes } from "./routes/auth.js";
import { chatRoutes } from "./routes/chats.js";
import { healthRoutes } from "./routes/health.js";
import { profileRoutes } from "./routes/profile.js";
import { socialRoutes } from "./routes/social.js";
const app = Fastify({
    logger: {
        level: env.NODE_ENV === "production" ? "info" : "debug",
        transport: env.NODE_ENV === "production"
            ? undefined
            : {
                target: "pino-pretty",
                options: {
                    translateTime: "SYS:standard",
                    ignore: "pid,hostname"
                }
            }
    }
});
await app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((x) => x.trim()),
    credentials: true
});
await app.register(cookie);
await app.register(jwt, { secret: env.JWT_ACCESS_SECRET });
await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.ip
});
await app.register(multipart, {
    limits: {
        fileSize: env.MAX_IMAGE_SIZE_MB * 1024 * 1024,
        files: 1
    }
});
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(profileRoutes);
await app.register(chatRoutes);
await app.register(socialRoutes);
await app.register(attachmentRoutes);
await app.register(adminRoutes);
app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    if (error.validation) {
        return reply.code(400).send({ error: "VALIDATION_ERROR" });
    }
    return reply.code(500).send({ error: "INTERNAL_ERROR" });
});
async function start() {
    try {
        await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
        app.log.info(`API started at port ${env.API_PORT}`);
        app.log.info(`SMS provider: ${env.SMS_PROVIDER}`);
        if (env.OTP_ALLOW_ANY_CODE) {
            app.log.warn("OTP bypass mode is ENABLED: any OTP code will pass verification.");
        }
    }
    catch (error) {
        app.log.error(error);
        process.exit(1);
    }
}
async function shutdown() {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
await start();

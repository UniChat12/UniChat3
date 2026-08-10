import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../config.js";
import { writeAuditLog } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import {
  comparePassword,
  deviceHash,
  generateOtpCode,
  generateRecoveryCode,
  hashPassword,
  normalizePhone,
  nowPlusDays,
  nowPlusSeconds,
  randomToken,
  sha256
} from "../lib/security.js";
import { sendOtpSms } from "../lib/sms.js";
import { requireAuth } from "../plugins/auth.js";

const requestOtpSchema = z.object({
  phone: z.string().min(7).max(20)
});

const verifyOtpSchema = z.object({
  phone: z.string().min(7).max(20),
  code: z.string().min(1).max(12),
  deviceName: z.string().max(80).optional(),
  locale: z.enum(["ru", "en"]).default("ru"),
  cloudPassword: z.string().max(128).optional(),
  recoveryCode: z.string().max(20).optional()
});

const refreshSchema = z.object({
  refreshToken: z.string().min(30)
});

const setCloudPasswordSchema = z.object({
  password: z.string().min(env.CLOUD_PASSWORD_MIN_LENGTH).max(128)
});

async function generateRecoveryCodes(userId: string): Promise<string[]> {
  const plainCodes = Array.from({ length: 10 }, () => generateRecoveryCode());

  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId } }),
    prisma.recoveryCode.createMany({
      data: plainCodes.map((code) => ({ userId, codeHash: sha256(code) }))
    })
  ]);

  return plainCodes;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/auth/request-otp", async (request, reply) => {
    const parsed = requestOtpSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_PAYLOAD" });
    }

    const phone = normalizePhone(parsed.data.phone);
    const code = generateOtpCode();
    const codeHash = sha256(code);

    await prisma.otpCode.create({
      data: {
        phone,
        codeHash,
        expiresAt: nowPlusSeconds(env.OTP_TTL_SECONDS)
      }
    });

    const smsResult = await sendOtpSms(phone, code);
    if (!smsResult.accepted) {
      return reply.code(502).send({ error: "SMS_PROVIDER_FAILED" });
    }

    await writeAuditLog({
      request,
      action: "AUTH_REQUEST_OTP",
      targetType: "PHONE",
      targetId: phone,
      meta: {
        ttlSeconds: env.OTP_TTL_SECONDS,
        provider: smsResult.provider,
        mockBypassEnabled: env.OTP_ALLOW_ANY_CODE
      }
    });

    return reply.send({
      ok: true,
      expiresIn: env.OTP_TTL_SECONDS,
      provider: smsResult.provider,
      otpDebug: env.SMS_PROVIDER === "mock" ? code : undefined
    });
  });

  app.post("/v1/auth/verify-otp", async (request, reply) => {
    const parsed = verifyOtpSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_PAYLOAD" });
    }

    const { code, locale } = parsed.data;
    const phone = normalizePhone(parsed.data.phone);

    if (!env.OTP_ALLOW_ANY_CODE) {
      const otp = await prisma.otpCode.findFirst({
        where: { phone, usedAt: null },
        orderBy: { createdAt: "desc" }
      });

      if (!otp) {
        return reply.code(400).send({ error: "OTP_NOT_FOUND" });
      }

      if (otp.expiresAt < new Date()) {
        return reply.code(400).send({ error: "OTP_EXPIRED" });
      }

      if (otp.attempts >= env.OTP_MAX_ATTEMPTS) {
        return reply.code(429).send({ error: "OTP_LOCKED" });
      }

      if (otp.codeHash !== sha256(code)) {
        await prisma.otpCode.update({
          where: { id: otp.id },
          data: { attempts: { increment: 1 } }
        });
        return reply.code(400).send({ error: "INVALID_OTP" });
      }

      await prisma.otpCode.update({
        where: { id: otp.id },
        data: { usedAt: new Date() }
      });
    } else {
      await writeAuditLog({
        request,
        action: "AUTH_VERIFY_OTP_BYPASS",
        targetType: "PHONE",
        targetId: phone,
        meta: { codeLength: code.length }
      });
    }

    let user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      const usersCount = await prisma.user.count();
      user = await prisma.user.create({
        data: {
          phone,
          locale,
          isAdmin: usersCount === 0
        }
      });
    } else if (user.locale !== locale) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { locale }
      });
    }

    if (user.isBanned) {
      return reply.code(403).send({ error: "USER_BANNED", reason: user.bannedReason });
    }

    const seed = `${request.headers["user-agent"] ?? "unknown"}|${request.ip}`;
    const currentDeviceHash = deviceHash(seed);

    const device = await prisma.device.upsert({
      where: {
        userId_deviceHash: {
          userId: user.id,
          deviceHash: currentDeviceHash
        }
      },
      create: {
        userId: user.id,
        deviceHash: currentDeviceHash,
        deviceName: parsed.data.deviceName,
        userAgent: request.headers["user-agent"] ?? null,
        ipAddress: request.ip,
        trusted: false
      },
      update: {
        lastSeenAt: new Date(),
        userAgent: request.headers["user-agent"] ?? null,
        ipAddress: request.ip,
        deviceName: parsed.data.deviceName
      }
    });

    let mustResetCloudPassword = false;

    if (user.cloudPasswordHash && !device.trusted) {
      let authorized = false;

      if (parsed.data.cloudPassword) {
        authorized = await comparePassword(parsed.data.cloudPassword, user.cloudPasswordHash);
      }

      if (!authorized && parsed.data.recoveryCode) {
        const recovery = await prisma.recoveryCode.findFirst({
          where: {
            userId: user.id,
            codeHash: sha256(parsed.data.recoveryCode),
            usedAt: null
          }
        });

        if (recovery) {
          authorized = true;
          mustResetCloudPassword = true;
          await prisma.recoveryCode.update({
            where: { id: recovery.id },
            data: { usedAt: new Date() }
          });
        }
      }

      if (!authorized) {
        return reply.code(401).send({ error: "CLOUD_PASSWORD_REQUIRED" });
      }
    }

    await prisma.device.update({
      where: { id: device.id },
      data: { trusted: true, lastSeenAt: new Date() }
    });

    const refreshToken = randomToken();
    const refreshTokenHash = sha256(refreshToken);
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        deviceId: device.id,
        refreshTokenHash,
        expiresAt: nowPlusDays(env.JWT_REFRESH_TTL_DAYS)
      }
    });

    const accessToken = await app.jwt.sign({
      uid: user.id,
      sid: session.id,
      did: device.id,
      role: user.isAdmin ? "admin" : "user"
    });

    await writeAuditLog({
      request,
      action: "AUTH_LOGIN",
      targetType: "USER",
      targetId: user.id,
      actorUserId: user.id,
      meta: {
        admin: user.isAdmin,
        mustResetCloudPassword,
        otpBypassEnabled: env.OTP_ALLOW_ANY_CODE
      }
    });

    return reply.send({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        bio: user.bio,
        avatarAttachmentId: user.avatarAttachmentId,
        locale: user.locale,
        isAdmin: user.isAdmin,
        hasCloudPassword: Boolean(user.cloudPasswordHash),
        needsOnboarding: !user.firstName || !user.lastName
      },
      mustResetCloudPassword
    });
  });

  app.post("/v1/auth/refresh", async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_PAYLOAD" });
    }

    const incomingHash = sha256(parsed.data.refreshToken);

    const session = await prisma.session.findFirst({
      where: {
        refreshTokenHash: incomingHash,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    });

    if (!session) {
      return reply.code(401).send({ error: "INVALID_REFRESH" });
    }

    if (session.user.isBanned) {
      await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      return reply.code(403).send({ error: "USER_BANNED" });
    }

    const refreshToken = randomToken();
    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: sha256(refreshToken),
        expiresAt: nowPlusDays(env.JWT_REFRESH_TTL_DAYS)
      }
    });

    const accessToken = await app.jwt.sign({
      uid: session.userId,
      sid: session.id,
      did: session.deviceId,
      role: session.user.isAdmin ? "admin" : "user"
    });

    return reply.send({ accessToken, refreshToken });
  });

  app.post("/v1/auth/logout", { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.auth) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    await prisma.session.updateMany({
      where: {
        id: request.auth.sid,
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });

    await writeAuditLog({
      request,
      action: "AUTH_LOGOUT",
      targetType: "SESSION",
      targetId: request.auth.sid,
      actorUserId: request.auth.uid
    });

    return reply.send({ ok: true });
  });

  app.post("/v1/auth/cloud-password", { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.auth) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    const parsed = setCloudPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_PAYLOAD" });
    }

    await prisma.user.update({
      where: { id: request.auth.uid },
      data: {
        cloudPasswordHash: await hashPassword(parsed.data.password)
      }
    });

    const recoveryCodes = await generateRecoveryCodes(request.auth.uid);

    await writeAuditLog({
      request,
      action: "AUTH_SET_CLOUD_PASSWORD",
      targetType: "USER",
      targetId: request.auth.uid,
      actorUserId: request.auth.uid
    });

    return reply.send({ ok: true, recoveryCodes });
  });
}

import type { FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

type WriteAuditInput = {
  request: FastifyRequest;
  action: string;
  targetType: string;
  targetId?: string;
  actorUserId?: string;
  meta?: Record<string, unknown>;
};

export async function writeAuditLog(input: WriteAuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      actorUserId: input.actorUserId,
      ipAddress: input.request.ip,
      userAgent: input.request.headers["user-agent"] ?? null,
      meta: input.meta as Prisma.InputJsonValue | undefined
    }
  });
}

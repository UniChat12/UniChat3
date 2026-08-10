import { prisma } from "./prisma.js";
export async function writeAuditLog(input) {
    await prisma.auditLog.create({
        data: {
            action: input.action,
            targetType: input.targetType,
            targetId: input.targetId,
            actorUserId: input.actorUserId,
            ipAddress: input.request.ip,
            userAgent: input.request.headers["user-agent"] ?? null,
            meta: input.meta
        }
    });
}

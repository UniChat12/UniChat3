import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { writeAuditLog } from "../lib/audit.js";
import { requireAdmin, requireAuth } from "../plugins/auth.js";
const banSchema = z.object({
    userId: z.string().uuid(),
    reason: z.string().min(3).max(500)
});
const resolveReportSchema = z.object({
    status: z.enum(["RESOLVED", "REJECTED"]),
    moderatorNote: z.string().max(1000).optional()
});
export async function adminRoutes(app) {
    app.get("/v1/admin/reports", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
        const query = z
            .object({
            status: z.enum(["OPEN", "RESOLVED", "REJECTED"]).optional(),
            limit: z.coerce.number().min(1).max(100).default(50)
        })
            .safeParse(request.query);
        if (!query.success) {
            return reply.code(400).send({ error: "INVALID_QUERY" });
        }
        const reports = await prisma.report.findMany({
            where: {
                ...(query.data.status ? { status: query.data.status } : {})
            },
            include: {
                reporter: { select: { id: true, phone: true } },
                targetUser: { select: { id: true, phone: true } },
                message: { select: { id: true, text: true, createdAt: true } }
            },
            orderBy: { createdAt: "desc" },
            take: query.data.limit
        });
        return reply.send({ reports });
    });
    app.patch("/v1/admin/reports/:reportId", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
        const params = z.object({ reportId: z.string().uuid() }).safeParse(request.params);
        const body = resolveReportSchema.safeParse(request.body);
        if (!params.success || !body.success) {
            return reply.code(400).send({ error: "INVALID_PAYLOAD" });
        }
        const report = await prisma.report.update({
            where: { id: params.data.reportId },
            data: {
                status: body.data.status,
                moderatorNote: body.data.moderatorNote,
                resolvedAt: new Date()
            }
        });
        await writeAuditLog({
            request,
            action: "REPORT_RESOLVE",
            targetType: "REPORT",
            targetId: report.id,
            actorUserId: request.auth?.uid,
            meta: { status: report.status }
        });
        return reply.send({ ok: true, report });
    });
    app.post("/v1/admin/bans", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
        const parsed = banSchema.safeParse(request.body);
        if (!parsed.success || !request.auth) {
            return reply.code(400).send({ error: "INVALID_PAYLOAD" });
        }
        const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
        if (!user) {
            return reply.code(404).send({ error: "USER_NOT_FOUND" });
        }
        await prisma.$transaction([
            prisma.user.update({
                where: { id: parsed.data.userId },
                data: {
                    isBanned: true,
                    bannedReason: parsed.data.reason
                }
            }),
            prisma.ban.create({
                data: {
                    userId: parsed.data.userId,
                    bannedById: request.auth.uid,
                    reason: parsed.data.reason
                }
            }),
            prisma.session.updateMany({
                where: { userId: parsed.data.userId, revokedAt: null },
                data: { revokedAt: new Date() }
            })
        ]);
        await writeAuditLog({
            request,
            action: "USER_BAN",
            targetType: "USER",
            targetId: parsed.data.userId,
            actorUserId: request.auth.uid,
            meta: { reason: parsed.data.reason }
        });
        return reply.send({ ok: true });
    });
    app.delete("/v1/admin/bans/:userId", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
        const params = z.object({ userId: z.string().uuid() }).safeParse(request.params);
        if (!params.success || !request.auth) {
            return reply.code(400).send({ error: "INVALID_PARAMS" });
        }
        await prisma.$transaction([
            prisma.user.update({
                where: { id: params.data.userId },
                data: { isBanned: false, bannedReason: null }
            }),
            prisma.ban.updateMany({
                where: { userId: params.data.userId, revokedAt: null },
                data: { revokedAt: new Date() }
            })
        ]);
        await writeAuditLog({
            request,
            action: "USER_UNBAN",
            targetType: "USER",
            targetId: params.data.userId,
            actorUserId: request.auth.uid
        });
        return reply.send({ ok: true });
    });
}

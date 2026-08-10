import { z } from "zod";
import { ChatRole, ChatType, MessageType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { writeAuditLog } from "../lib/audit.js";
import { requireAuth } from "../plugins/auth.js";
const createPrivateSchema = z.object({
    targetUserId: z.string().uuid()
});
const createGroupSchema = z.object({
    title: z.string().min(2).max(80),
    memberIds: z.array(z.string().uuid()).max(99)
});
const sendMessageSchema = z.object({
    text: z.string().max(4000).optional(),
    attachmentId: z.string().uuid().optional(),
    replyToId: z.string().uuid().optional()
});
const editMessageSchema = z.object({
    text: z.string().min(1).max(4000)
});
const reportSchema = z.object({
    reason: z.string().min(3).max(500)
});
async function ensureMember(userId, chatId) {
    const member = await prisma.chatMember.findFirst({ where: { userId, chatId } });
    return Boolean(member);
}
export async function chatRoutes(app) {
    app.get("/v1/chats", { preHandler: [requireAuth] }, async (request, reply) => {
        if (!request.auth) {
            return reply.code(401).send({ error: "UNAUTHORIZED" });
        }
        const members = await prisma.chatMember.findMany({
            where: { userId: request.auth.uid },
            include: {
                chat: {
                    include: {
                        messages: {
                            where: { deletedForAllAt: null },
                            orderBy: { createdAt: "desc" },
                            take: 1
                        },
                        members: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        displayName: true,
                                        firstName: true,
                                        lastName: true,
                                        avatarAttachmentId: true,
                                        phone: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { joinedAt: "desc" }
        });
        const chats = members.map((m) => {
            const peer = m.chat.members.find((x) => x.userId !== request.auth?.uid)?.user;
            const peerDisplayName = `${peer?.firstName ?? ""} ${peer?.lastName ?? ""}`.trim() || peer?.displayName || peer?.phone;
            return {
                id: m.chat.id,
                type: m.chat.type,
                title: m.chat.type === ChatType.GROUP ? m.chat.title : peerDisplayName,
                members: m.chat.members.map((cm) => ({
                    userId: cm.userId,
                    role: cm.role
                })),
                lastMessage: m.chat.messages[0] ?? null
            };
        });
        return reply.send({ chats });
    });
    app.post("/v1/chats/private", { preHandler: [requireAuth] }, async (request, reply) => {
        if (!request.auth) {
            return reply.code(401).send({ error: "UNAUTHORIZED" });
        }
        const parsed = createPrivateSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: "INVALID_PAYLOAD" });
        }
        if (parsed.data.targetUserId === request.auth.uid) {
            return reply.code(400).send({ error: "SELF_CHAT_NOT_ALLOWED" });
        }
        const block = await prisma.block.findFirst({
            where: {
                OR: [
                    { actorId: request.auth.uid, targetId: parsed.data.targetUserId },
                    { actorId: parsed.data.targetUserId, targetId: request.auth.uid }
                ]
            }
        });
        if (block) {
            return reply.code(403).send({ error: "CHAT_BLOCKED" });
        }
        const target = await prisma.user.findUnique({ where: { id: parsed.data.targetUserId } });
        if (!target || target.isBanned) {
            return reply.code(404).send({ error: "TARGET_NOT_FOUND" });
        }
        const existing = await prisma.chat.findFirst({
            where: {
                type: ChatType.PRIVATE,
                members: {
                    some: { userId: request.auth.uid }
                },
                AND: {
                    members: {
                        some: { userId: parsed.data.targetUserId }
                    }
                }
            },
            include: { members: true }
        });
        if (existing && existing.members.length === 2) {
            return reply.send({ chatId: existing.id });
        }
        const chat = await prisma.chat.create({
            data: {
                type: ChatType.PRIVATE,
                members: {
                    create: [
                        { userId: request.auth.uid, role: ChatRole.OWNER },
                        { userId: parsed.data.targetUserId, role: ChatRole.MEMBER }
                    ]
                }
            }
        });
        await writeAuditLog({
            request,
            action: "CHAT_CREATE_PRIVATE",
            targetType: "CHAT",
            targetId: chat.id,
            actorUserId: request.auth.uid,
            meta: { targetUserId: parsed.data.targetUserId }
        });
        return reply.code(201).send({ chatId: chat.id });
    });
    app.post("/v1/chats/group", { preHandler: [requireAuth] }, async (request, reply) => {
        if (!request.auth) {
            return reply.code(401).send({ error: "UNAUTHORIZED" });
        }
        const parsed = createGroupSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: "INVALID_PAYLOAD" });
        }
        const uniqueMembers = Array.from(new Set(parsed.data.memberIds.filter((id) => id !== request.auth?.uid)));
        const totalMembers = uniqueMembers.length + 1;
        if (totalMembers > 100) {
            return reply.code(400).send({ error: "GROUP_LIMIT_EXCEEDED" });
        }
        const existingUsers = await prisma.user.findMany({ where: { id: { in: uniqueMembers }, isBanned: false } });
        if (existingUsers.length !== uniqueMembers.length) {
            return reply.code(400).send({ error: "INVALID_MEMBER_SET" });
        }
        const chat = await prisma.chat.create({
            data: {
                type: ChatType.GROUP,
                title: parsed.data.title,
                ownerId: request.auth.uid,
                members: {
                    create: [
                        { userId: request.auth.uid, role: ChatRole.OWNER },
                        ...uniqueMembers.map((userId) => ({ userId, role: ChatRole.MEMBER }))
                    ]
                }
            }
        });
        await writeAuditLog({
            request,
            action: "CHAT_CREATE_GROUP",
            targetType: "CHAT",
            targetId: chat.id,
            actorUserId: request.auth.uid,
            meta: { memberCount: totalMembers }
        });
        return reply.code(201).send({ chatId: chat.id });
    });
    app.get("/v1/chats/:chatId/messages", { preHandler: [requireAuth] }, async (request, reply) => {
        if (!request.auth) {
            return reply.code(401).send({ error: "UNAUTHORIZED" });
        }
        const requestParams = (request.params ?? {});
        const requestQuery = (request.query ?? {});
        const params = z
            .object({
            chatId: z.string().uuid(),
            cursor: z.string().uuid().optional(),
            limit: z.coerce.number().min(1).max(100).default(50)
        })
            .safeParse({ ...requestParams, ...requestQuery });
        if (!params.success) {
            return reply.code(400).send({ error: "INVALID_PARAMS" });
        }
        const isMember = await ensureMember(request.auth.uid, params.data.chatId);
        if (!isMember) {
            return reply.code(403).send({ error: "NOT_CHAT_MEMBER" });
        }
        const messages = await prisma.message.findMany({
            where: {
                chatId: params.data.chatId,
                deletedForAllAt: null,
                ...(params.data.cursor ? { id: { lt: params.data.cursor } } : {})
            },
            include: {
                sender: { select: { id: true, displayName: true, firstName: true, lastName: true, phone: true } },
                attachment: true
            },
            orderBy: { createdAt: "desc" },
            take: params.data.limit
        });
        return reply.send({ messages });
    });
    app.post("/v1/chats/:chatId/messages", { preHandler: [requireAuth] }, async (request, reply) => {
        if (!request.auth) {
            return reply.code(401).send({ error: "UNAUTHORIZED" });
        }
        const params = z.object({ chatId: z.string().uuid() }).safeParse(request.params);
        const body = sendMessageSchema.safeParse(request.body);
        if (!params.success || !body.success) {
            return reply.code(400).send({ error: "INVALID_PAYLOAD" });
        }
        const hasPayload = Boolean(body.data.text?.trim()) || Boolean(body.data.attachmentId);
        if (!hasPayload) {
            return reply.code(400).send({ error: "EMPTY_MESSAGE" });
        }
        const member = await prisma.chatMember.findFirst({
            where: { chatId: params.data.chatId, userId: request.auth.uid }
        });
        if (!member) {
            return reply.code(403).send({ error: "NOT_CHAT_MEMBER" });
        }
        if (body.data.attachmentId) {
            const attachment = await prisma.attachment.findUnique({ where: { id: body.data.attachmentId } });
            if (!attachment || attachment.uploaderId !== request.auth.uid) {
                return reply.code(400).send({ error: "INVALID_ATTACHMENT" });
            }
        }
        const message = await prisma.message.create({
            data: {
                chatId: params.data.chatId,
                senderId: request.auth.uid,
                type: body.data.attachmentId ? MessageType.IMAGE : MessageType.TEXT,
                text: body.data.text,
                attachmentId: body.data.attachmentId,
                replyToId: body.data.replyToId
            },
            include: {
                sender: { select: { id: true, displayName: true, firstName: true, lastName: true, phone: true } },
                attachment: true
            }
        });
        await writeAuditLog({
            request,
            action: "MESSAGE_SEND",
            targetType: "MESSAGE",
            targetId: message.id,
            actorUserId: request.auth.uid,
            meta: { chatId: params.data.chatId, type: message.type }
        });
        return reply.code(201).send({ message });
    });
    app.patch("/v1/messages/:messageId", { preHandler: [requireAuth] }, async (request, reply) => {
        if (!request.auth) {
            return reply.code(401).send({ error: "UNAUTHORIZED" });
        }
        const params = z.object({ messageId: z.string().uuid() }).safeParse(request.params);
        const body = editMessageSchema.safeParse(request.body);
        if (!params.success || !body.success) {
            return reply.code(400).send({ error: "INVALID_PAYLOAD" });
        }
        const message = await prisma.message.findUnique({ where: { id: params.data.messageId } });
        if (!message || message.deletedForAllAt) {
            return reply.code(404).send({ error: "MESSAGE_NOT_FOUND" });
        }
        if (message.senderId !== request.auth.uid) {
            return reply.code(403).send({ error: "NOT_OWNER" });
        }
        const updated = await prisma.message.update({
            where: { id: message.id },
            data: {
                text: body.data.text,
                editedAt: new Date()
            }
        });
        return reply.send({ message: updated });
    });
    app.delete("/v1/messages/:messageId", { preHandler: [requireAuth] }, async (request, reply) => {
        if (!request.auth) {
            return reply.code(401).send({ error: "UNAUTHORIZED" });
        }
        const params = z.object({ messageId: z.string().uuid() }).safeParse(request.params);
        if (!params.success) {
            return reply.code(400).send({ error: "INVALID_PARAMS" });
        }
        const message = await prisma.message.findUnique({ where: { id: params.data.messageId } });
        if (!message || message.deletedForAllAt) {
            return reply.code(404).send({ error: "MESSAGE_NOT_FOUND" });
        }
        if (message.senderId !== request.auth.uid) {
            return reply.code(403).send({ error: "NOT_OWNER" });
        }
        await prisma.message.update({
            where: { id: message.id },
            data: { deletedForAllAt: new Date(), text: null }
        });
        return reply.send({ ok: true });
    });
    app.post("/v1/messages/:messageId/report", { preHandler: [requireAuth] }, async (request, reply) => {
        if (!request.auth) {
            return reply.code(401).send({ error: "UNAUTHORIZED" });
        }
        const params = z.object({ messageId: z.string().uuid() }).safeParse(request.params);
        const body = reportSchema.safeParse(request.body);
        if (!params.success || !body.success) {
            return reply.code(400).send({ error: "INVALID_PAYLOAD" });
        }
        const message = await prisma.message.findUnique({ where: { id: params.data.messageId } });
        if (!message) {
            return reply.code(404).send({ error: "MESSAGE_NOT_FOUND" });
        }
        const report = await prisma.report.create({
            data: {
                reporterId: request.auth.uid,
                targetUserId: message.senderId,
                chatId: message.chatId,
                messageId: message.id,
                reason: body.data.reason
            }
        });
        await writeAuditLog({
            request,
            action: "REPORT_CREATE",
            targetType: "REPORT",
            targetId: report.id,
            actorUserId: request.auth.uid,
            meta: { messageId: message.id }
        });
        return reply.code(201).send({ reportId: report.id });
    });
    app.post("/v1/users/:targetUserId/block", { preHandler: [requireAuth] }, async (request, reply) => {
        if (!request.auth) {
            return reply.code(401).send({ error: "UNAUTHORIZED" });
        }
        const params = z.object({ targetUserId: z.string().uuid() }).safeParse(request.params);
        if (!params.success) {
            return reply.code(400).send({ error: "INVALID_PARAMS" });
        }
        if (params.data.targetUserId === request.auth.uid) {
            return reply.code(400).send({ error: "SELF_BLOCK_NOT_ALLOWED" });
        }
        await prisma.block.upsert({
            where: {
                actorId_targetId: {
                    actorId: request.auth.uid,
                    targetId: params.data.targetUserId
                }
            },
            create: {
                actorId: request.auth.uid,
                targetId: params.data.targetUserId
            },
            update: {}
        });
        await writeAuditLog({
            request,
            action: "USER_BLOCK",
            targetType: "USER",
            targetId: params.data.targetUserId,
            actorUserId: request.auth.uid
        });
        return reply.send({ ok: true });
    });
}

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { writeAuditLog } from "../lib/audit.js";
import { requireAuth } from "../plugins/auth.js";

const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(60).optional(),
    lastName: z.string().trim().min(1).max(60).optional(),
    bio: z.string().trim().max(280).optional(),
    avatarAttachmentId: z.string().uuid().nullable().optional(),
    locale: z.enum(["ru", "en"]).optional()
  })
  .refine((data) => Object.keys(data).length > 0, "EMPTY_PAYLOAD");

function fullDisplayName(firstName?: string | null, lastName?: string | null): string | null {
  const full = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return full.length > 0 ? full : null;
}

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/profile/me", { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.auth) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    const user = await prisma.user.findUnique({
      where: { id: request.auth.uid },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        displayName: true,
        bio: true,
        avatarAttachmentId: true,
        locale: true,
        isAdmin: true,
        cloudPasswordHash: true
      }
    });

    if (!user) {
      return reply.code(404).send({ error: "USER_NOT_FOUND" });
    }

    const [contactsCount, chatsCount, postsCount] = await Promise.all([
      prisma.contact.count({ where: { ownerId: user.id } }),
      prisma.chatMember.count({ where: { userId: user.id } }),
      prisma.post.count({ where: { authorId: user.id } })
    ]);

    return reply.send({
      user: {
        ...user,
        hasCloudPassword: Boolean(user.cloudPasswordHash),
        needsOnboarding: !user.firstName || !user.lastName
      },
      counters: {
        contactsCount,
        chatsCount,
        postsCount
      }
    });
  });

  app.patch("/v1/profile/me", { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.auth) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_PAYLOAD" });
    }

    const payload = parsed.data;

    if (payload.avatarAttachmentId) {
      const attachment = await prisma.attachment.findUnique({ where: { id: payload.avatarAttachmentId } });
      if (!attachment || attachment.uploaderId !== request.auth.uid) {
        return reply.code(400).send({ error: "INVALID_AVATAR_ATTACHMENT" });
      }
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: request.auth.uid },
      select: { firstName: true, lastName: true }
    });

    if (!existingUser) {
      return reply.code(404).send({ error: "USER_NOT_FOUND" });
    }

    const firstName = payload.firstName ?? existingUser.firstName;
    const lastName = payload.lastName ?? existingUser.lastName;

    const user = await prisma.user.update({
      where: { id: request.auth.uid },
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        bio: payload.bio,
        avatarAttachmentId: payload.avatarAttachmentId,
        locale: payload.locale,
        displayName: fullDisplayName(firstName, lastName)
      },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        displayName: true,
        bio: true,
        avatarAttachmentId: true,
        locale: true,
        isAdmin: true,
        cloudPasswordHash: true
      }
    });

    await writeAuditLog({
      request,
      action: "PROFILE_UPDATE",
      targetType: "USER",
      targetId: request.auth.uid,
      actorUserId: request.auth.uid,
      meta: {
        updatedFields: Object.keys(payload)
      }
    });

    return reply.send({
      user: {
        ...user,
        hasCloudPassword: Boolean(user.cloudPasswordHash),
        needsOnboarding: !user.firstName || !user.lastName
      }
    });
  });
}

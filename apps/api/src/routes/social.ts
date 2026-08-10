import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { writeAuditLog } from "../lib/audit.js";
import { requireAuth } from "../plugins/auth.js";

const addContactSchema = z.object({
  targetUserId: z.string().uuid()
});

const createPostSchema = z
  .object({
    text: z.string().trim().max(2000).optional(),
    attachmentId: z.string().uuid().optional()
  })
  .refine((data) => Boolean(data.text) || Boolean(data.attachmentId), "POST_EMPTY");

const toggleLikeParamsSchema = z.object({
  postId: z.string().uuid()
});

export async function socialRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/users/search", { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.auth) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    const query = z
      .object({
        q: z.string().trim().min(1).max(60)
      })
      .safeParse(request.query);

    if (!query.success) {
      return reply.code(400).send({ error: "INVALID_QUERY" });
    }

    const q = query.data.q;
    const normalizedDigits = q.replace(/[^\d+]/g, "");

    const users = await prisma.user.findMany({
      where: {
        id: { not: request.auth.uid },
        isBanned: false,
        OR: [
          { phone: { contains: normalizedDigits || q } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { displayName: { contains: q, mode: "insensitive" } }
        ]
      },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatarAttachmentId: true
      },
      take: 30,
      orderBy: { createdAt: "desc" }
    });

    const contactIds = new Set(
      (
        await prisma.contact.findMany({
          where: {
            ownerId: request.auth.uid,
            targetId: { in: users.map((u) => u.id) }
          },
          select: { targetId: true }
        })
      ).map((c) => c.targetId)
    );

    return reply.send({
      users: users.map((u) => ({
        ...u,
        isContact: contactIds.has(u.id)
      }))
    });
  });

  app.get("/v1/contacts", { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.auth) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    const contacts = await prisma.contact.findMany({
      where: { ownerId: request.auth.uid },
      include: {
        target: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarAttachmentId: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return reply.send({
      contacts: contacts.map((contact) => ({
        id: contact.id,
        createdAt: contact.createdAt,
        user: contact.target
      }))
    });
  });

  app.post("/v1/contacts", { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.auth) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    const parsed = addContactSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_PAYLOAD" });
    }

    if (parsed.data.targetUserId === request.auth.uid) {
      return reply.code(400).send({ error: "SELF_CONTACT_NOT_ALLOWED" });
    }

    const target = await prisma.user.findUnique({ where: { id: parsed.data.targetUserId } });
    if (!target || target.isBanned) {
      return reply.code(404).send({ error: "TARGET_NOT_FOUND" });
    }

    const contact = await prisma.contact.upsert({
      where: {
        ownerId_targetId: {
          ownerId: request.auth.uid,
          targetId: parsed.data.targetUserId
        }
      },
      create: {
        ownerId: request.auth.uid,
        targetId: parsed.data.targetUserId
      },
      update: {},
      include: {
        target: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarAttachmentId: true
          }
        }
      }
    });

    await writeAuditLog({
      request,
      action: "CONTACT_ADD",
      targetType: "USER",
      targetId: parsed.data.targetUserId,
      actorUserId: request.auth.uid
    });

    return reply.code(201).send({
      contact: {
        id: contact.id,
        createdAt: contact.createdAt,
        user: contact.target
      }
    });
  });

  app.delete("/v1/contacts/:targetUserId", { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.auth) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    const params = z.object({ targetUserId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "INVALID_PARAMS" });
    }

    await prisma.contact.deleteMany({
      where: {
        ownerId: request.auth.uid,
        targetId: params.data.targetUserId
      }
    });

    await writeAuditLog({
      request,
      action: "CONTACT_REMOVE",
      targetType: "USER",
      targetId: params.data.targetUserId,
      actorUserId: request.auth.uid
    });

    return reply.send({ ok: true });
  });

  app.get("/v1/feed/posts", { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.auth) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    const query = z
      .object({
        limit: z.coerce.number().min(1).max(50).default(20)
      })
      .safeParse(request.query);

    if (!query.success) {
      return reply.code(400).send({ error: "INVALID_QUERY" });
    }

    const posts = await prisma.post.findMany({
      include: {
        author: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarAttachmentId: true
          }
        },
        likes: {
          where: { userId: request.auth.uid },
          select: { id: true }
        },
        _count: {
          select: { likes: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: query.data.limit
    });

    return reply.send({
      posts: posts.map((post) => ({
        id: post.id,
        text: post.text,
        attachmentId: post.attachmentId,
        createdAt: post.createdAt,
        author: post.author,
        likedByMe: post.likes.length > 0,
        likesCount: post._count.likes
      }))
    });
  });

  app.post("/v1/feed/posts", { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.auth) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    const parsed = createPostSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_PAYLOAD" });
    }

    if (parsed.data.attachmentId) {
      const attachment = await prisma.attachment.findUnique({ where: { id: parsed.data.attachmentId } });
      if (!attachment || attachment.uploaderId !== request.auth.uid) {
        return reply.code(400).send({ error: "INVALID_ATTACHMENT" });
      }
    }

    const post = await prisma.post.create({
      data: {
        authorId: request.auth.uid,
        text: parsed.data.text,
        attachmentId: parsed.data.attachmentId
      },
      include: {
        author: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarAttachmentId: true
          }
        }
      }
    });

    await writeAuditLog({
      request,
      action: "POST_CREATE",
      targetType: "POST",
      targetId: post.id,
      actorUserId: request.auth.uid
    });

    return reply.code(201).send({
      post: {
        id: post.id,
        text: post.text,
        attachmentId: post.attachmentId,
        createdAt: post.createdAt,
        author: post.author,
        likedByMe: false,
        likesCount: 0
      }
    });
  });

  app.post("/v1/feed/posts/:postId/like", { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.auth) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    const params = toggleLikeParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "INVALID_PARAMS" });
    }

    const post = await prisma.post.findUnique({ where: { id: params.data.postId } });
    if (!post) {
      return reply.code(404).send({ error: "POST_NOT_FOUND" });
    }

    const existingLike = await prisma.postLike.findUnique({
      where: {
        postId_userId: {
          postId: params.data.postId,
          userId: request.auth.uid
        }
      }
    });

    let likedByMe = false;

    if (existingLike) {
      await prisma.postLike.delete({ where: { id: existingLike.id } });
      likedByMe = false;
    } else {
      await prisma.postLike.create({
        data: {
          postId: params.data.postId,
          userId: request.auth.uid
        }
      });
      likedByMe = true;
    }

    const likesCount = await prisma.postLike.count({ where: { postId: params.data.postId } });

    return reply.send({ likedByMe, likesCount });
  });
}

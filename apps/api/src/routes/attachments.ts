import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { allowedImageMime, env } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../plugins/auth.js";

export async function attachmentRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/attachments/image", { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.auth) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    const upload = await request.file();
    if (!upload) {
      return reply.code(400).send({ error: "FILE_REQUIRED" });
    }

    if (!allowedImageMime.includes(upload.mimetype)) {
      return reply.code(400).send({ error: "UNSUPPORTED_IMAGE_TYPE" });
    }

    const bytes = await upload.toBuffer();
    const maxBytes = env.MAX_IMAGE_SIZE_MB * 1024 * 1024;

    if (bytes.byteLength > maxBytes) {
      return reply.code(400).send({ error: "IMAGE_TOO_LARGE", maxMb: env.MAX_IMAGE_SIZE_MB });
    }

    const ext = upload.mimetype === "image/png" ? "png" : upload.mimetype === "image/webp" ? "webp" : "jpg";
    const id = randomUUID();
    const today = new Date().toISOString().slice(0, 10);
    const baseDir = path.join(env.UPLOAD_DIR, today);
    const originalName = `${id}.${ext}`;
    const previewName = `${id}_preview.webp`;

    await fs.mkdir(baseDir, { recursive: true });

    const metadata = await sharp(bytes).metadata();

    const originalPath = path.join(baseDir, originalName);
    const previewPath = path.join(baseDir, previewName);

    await fs.writeFile(originalPath, bytes);
    await sharp(bytes).resize({ width: 320, withoutEnlargement: true }).webp({ quality: 82 }).toFile(previewPath);

    const attachment = await prisma.attachment.create({
      data: {
        uploaderId: request.auth.uid,
        filePath: path.relative(process.cwd(), originalPath).replace(/\\/g, "/"),
        previewPath: path.relative(process.cwd(), previewPath).replace(/\\/g, "/"),
        mimeType: upload.mimetype,
        sizeBytes: bytes.byteLength,
        width: metadata.width ?? null,
        height: metadata.height ?? null
      }
    });

    return reply.code(201).send({ attachment });
  });

  app.get("/v1/attachments/:id", async (request, reply) => {
    const authHeader = request.headers.authorization;
    const requestQuery = (request.query ?? {}) as Record<string, unknown>;
    const requestParams = (request.params ?? {}) as Record<string, unknown>;
    const queryToken = z.object({ token: z.string().optional() }).safeParse(requestQuery);
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;
    const token = bearerToken ?? (queryToken.success ? queryToken.data.token : undefined);

    if (!token) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    try {
      await request.server.jwt.verify(token);
    } catch {
      return reply.code(401).send({ error: "INVALID_TOKEN" });
    }

    const params = z.object({ id: z.string().uuid(), preview: z.enum(["1", "0"]).optional() }).safeParse({
      ...requestParams,
      ...requestQuery
    });

    if (!params.success) {
      return reply.code(400).send({ error: "INVALID_PARAMS" });
    }

    const attachment = await prisma.attachment.findUnique({ where: { id: params.data.id } });
    if (!attachment) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }

    const targetPath = params.data.preview === "1" ? attachment.previewPath : attachment.filePath;
    const absolutePath = path.join(process.cwd(), targetPath);

    try {
      const stat = await fs.stat(absolutePath);
      reply.header("Content-Type", params.data.preview === "1" ? "image/webp" : attachment.mimeType);
      reply.header("Content-Length", String(stat.size));
      return reply.send(await fs.readFile(absolutePath));
    } catch {
      return reply.code(404).send({ error: "FILE_MISSING" });
    }
  });
}

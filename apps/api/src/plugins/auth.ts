import type { FastifyReply, FastifyRequest } from "fastify";

export type AccessClaims = {
  uid: string;
  sid: string;
  did: string;
  role: "user" | "admin";
};

declare module "fastify" {
  interface FastifyRequest {
    auth?: AccessClaims;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    reply.code(401).send({ error: "UNAUTHORIZED" });
    return;
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = await request.server.jwt.verify<AccessClaims>(token);
    request.auth = payload;
  } catch {
    reply.code(401).send({ error: "INVALID_TOKEN" });
    return;
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.auth || request.auth.role !== "admin") {
    reply.code(403).send({ error: "ADMIN_ONLY" });
    return;
  }
}

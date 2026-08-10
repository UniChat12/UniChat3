export async function requireAuth(request, reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        reply.code(401).send({ error: "UNAUTHORIZED" });
        return;
    }
    const token = authHeader.slice("Bearer ".length);
    try {
        const payload = await request.server.jwt.verify(token);
        request.auth = payload;
    }
    catch {
        reply.code(401).send({ error: "INVALID_TOKEN" });
        return;
    }
}
export async function requireAdmin(request, reply) {
    if (!request.auth || request.auth.role !== "admin") {
        reply.code(403).send({ error: "ADMIN_ONLY" });
        return;
    }
}

# Anfeelgram Blueprint (Web, RU/CIS)

## 1) Executive Summary

Anfeelgram is planned as a secure web messenger with Telegram-like core features: phone auth + 2FA cloud password, private/group chats, image attachments, moderation via reports, bans, admin panel, audit logs, observability, and production deployment path.

Given current constraints (solo development, unknown exact traffic, local PC start, no domain yet), the practical approach is:
- Build a secure monolith first (modular backend + web app), production-ready by architecture.
- Launch with transport security, strict auth/session controls, audit logging, anti-abuse limits, and infra hardening.
- Ship E2EE for private chats in MVP/Beta, then group E2EE in phase 2 (to avoid delaying launch with cryptographic complexity).

Target baseline accepted:
- Up to 5k MAU, 500 online, 50 msg/s peak.
- Group size cap: 100.
- Photo only uploads (jpg/png/webp, max 10 MB) with preview generation.
- Reports + manual moderation, permanent ban/unban by owner-admin.

---

## 2) Functions -> Component -> Priority

| Function | Component | Priority |
|---|---|---|
| Phone registration/login | Auth API + OTP provider + users/devices/sessions tables | MVP |
| Cloud password 2FA + recovery codes | Auth API + recovery_codes + secure hash | MVP |
| 1:1 chat | Chat service + chat_members + messages | MVP |
| Group chats (<=100) | Chat service + roles + membership rules | MVP |
| Message edit/delete/reply | Message API + message metadata | MVP |
| Image attachments + preview | Upload API + file storage + preview worker | MVP |
| Search in chats/messages | PostgreSQL FTS + indexes | Next |
| Reports/abuse | Report API + admin queue | MVP |
| Ban/unban users | Admin API + bans + forced session revoke | MVP |
| Web push notifications | Push worker + VAPID + service worker | Next |
| Realtime delivery/read receipts | WebSocket gateway + Redis pub/sub | Next |
| E2EE private chats | Client crypto module + key service metadata | MVP/Beta |
| E2EE group chats | Sender keys / MLS-like approach | Next |
| Audit logs (180 days) | audit_logs table + log pipeline | MVP |
| Monitoring/alerts | Prometheus + Grafana + Loki + Alertmanager | MVP |

---

## 3) Architecture + Scheme

### A) Stack selection

### Variant 1: Fast MVP (recommended now)
- Backend: Node.js + Fastify + Prisma + PostgreSQL + Redis
- Frontend: React + Vite (PWA-ready)
- Realtime: WebSocket (Fastify WS or Socket.IO)
- Storage: local filesystem (later S3-compatible)
- Reverse proxy: Nginx
- Why:
  - Fastest solo-delivery path.
  - Large ecosystem for auth, validation, scanning, CI.
  - Easy migration from modular monolith to services.

### Variant 2: Enterprise / Maximum security
- Backend: Go (Fiber/Chi) or Rust, gRPC internal APIs
- Data: PostgreSQL + Redis + Kafka/NATS
- Crypto/key mgmt: Vault + HSM integration
- Frontend: Next.js (strict CSP, SSR admin panel)
- Infra: Kubernetes + service mesh + OPA policies
- Why:
  - Better isolation and horizontal scaling under high load.
  - Stronger governance and secret-control patterns.
  - Higher complexity and cost.

### B) Target architecture (phase-1)

```text
[Web Client (PWA)]
   | TLS (HTTPS/WSS)
   v
[Nginx Reverse Proxy + WAF rules]
   |
   +--> [API Gateway (Fastify)]
           |
           +--> [Auth Module]
           +--> [Chat Module]
           +--> [Attachment Module]
           +--> [Moderation/Admin Module]
           |
           +--> [PostgreSQL]
           +--> [Redis (rate limits, cache, pub/sub)]
           +--> [Local File Storage (/uploads)]
           |
           +--> [Audit Logs -> Loki/ELK]
           +--> [Metrics -> Prometheus -> Grafana]
```

### C) Data model (core tables)

- `users`: identity, locale, cloud password hash, admin flag, ban flags.
- `devices`: per-device binding (hash, UA, IP, trusted state).
- `sessions`: refresh-token hashes, expiry, revocation.
- `chats`: private/group chat container.
- `chat_members`: membership and role.
- `messages`: text/image message, reply, edit/delete markers.
- `attachments`: file metadata + preview path.
- `user_keys`: E2EE public keys + key versions.
- `audit_logs`: immutable security/admin events.
- `reports`: abuse reports workflow.
- `bans`: ban/unban records.
- `blocks`: user blocklist for communication controls.
- `otp_codes`, `recovery_codes`: auth supporting state.

---

## 4) Security + Threat Model

### D) Auth/session/E2EE protocol decisions

- Registration/login:
  - Phone OTP primary factor.
  - Cloud password second factor for new devices.
  - Recovery via one-time backup codes.
- Sessions:
  - Short-lived access token (JWT, 15m).
  - Opaque refresh token stored only as hash in DB.
  - Refresh rotation on each use.
  - Device binding by device fingerprint + IP/UA metadata.
- Rate limiting and brute-force defense:
  - OTP attempts capped.
  - IP-based and phone-based throttling.
  - Ban + challenge escalation path.
- Transport and storage:
  - TLS 1.2+ mandatory.
  - Passwords and recovery codes as bcrypt/SHA256 hashes.
  - Secrets only via env/secret manager, never in repo.
- E2EE scope:
  - Phase 1: private chats E2EE (Double Ratchet-style, using vetted libs).
  - Phase 2: group E2EE (sender keys or MLS-like design).
  - Server stores only ciphertext for E2EE chats; metadata still visible (who/when/chat id).
- Key storage:
  - Client device keeps private identity keys (WebCrypto + IndexedDB, encrypted by cloud password-derived key).
  - Server stores public keys and encrypted key envelopes only.
- Key rotation:
  - Automatic signed prekey rotation every 7 days.
  - Identity key rotation on security event/device reset.

### Threat table

| Threat | Risk | Controls |
|---|---|---|
| OTP brute-force | Account takeover | OTP TTL 120s, attempt cap, per-IP/phone rate limit, temporary lock |
| Refresh token theft | Session hijack | Hash-only refresh storage, rotation, device-bound sessions, revoke on anomaly |
| Credential stuffing | Unauthorized access | Cloud password 2FA, banned IP rules, fail2ban, login anomaly detection |
| MITM | Message/token interception | TLS, HSTS, secure headers, cert renewal automation |
| Injection (SQL/XSS) | Data exfiltration | Prisma + parameterization, strict validation (Zod), CSP, output encoding |
| Malicious upload | RCE/storage abuse | MIME allowlist, size cap, image-only, re-encode previews, AV scan in next phase |
| Abuse/spam | UX and legal risk | Report flow, manual moderation queue, bans, audit trails |
| Insider misuse | Privacy breach | RBAC in admin, audit logs immutable, least privilege |
| Infra compromise | Full system breach | OS hardening, firewall, secret isolation, backups + DR runbooks |
| Dependency CVE | Supply chain risk | SCA scans, pinning, patch cadence, signed images |

---

## 5) Sprint Plan (2-6 weeks milestones)

### E) Milestones

### Milestone 1 (Weeks 1-2): Secure Core MVP
- Auth: phone OTP, cloud password, sessions, recovery codes.
- Chat: private + group, messaging, edit/delete/reply.
- Uploads: image-only + preview.
- Admin: reports list, permaban/unban.
- Docker local stack + seed data.
- Minimum audit logs.

Definition of done:
- End-to-end local flow works in browser.
- Basic security checks pass.

### Milestone 2 (Weeks 3-4): Production Readiness Beta
- Realtime delivery/read statuses.
- Search (FTS), better pagination/indexes.
- Web push notifications.
- Observability stack and alerting.
- CI/CD gates with SAST/SCA/container scan.
- Initial hardening of Nginx + server baseline.

Definition of done:
- Deploy from `git push` to server.
- Monitoring and alerting live.

### Milestone 3 (Weeks 5-6): Hardening + E2EE
- Private chat E2EE module.
- Key rotation and key reset UX.
- Threat model review + penetration test checklist.
- Backup/restore drills + DR test.
- Compliance pack v1 (policies, registries, incident process).

Definition of done:
- Controlled production launch in RU/CIS.

---

## 6) DevOps / CI-CD / Deploy

### F) Repo structure and engineering process

```text
anfeelgram/
  apps/
    api/
      src/
      prisma/
      Dockerfile
    web/
      src/
      Dockerfile
  infra/
    nginx/
      default.conf
  docs/
    blueprint.md
  docker-compose.yml
  .github/workflows/ci-cd.yml
  README.md
```

- Strategy: monorepo.
- Branches: `main`, `develop`, `feature/*`, `hotfix/*`.
- Commit convention: Conventional Commits.
- PR rules:
  - No direct push to `main`.
  - 1 reviewer minimum (you can use self-checklist while solo).
  - Green CI required.

Code review security checklist:
- Input validation is explicit and strict.
- Auth checks before data access.
- No secrets in code/logs.
- Error responses do not leak internals.
- Audit logs for admin/security actions.
- Migration/index impact reviewed.

### G) Local startup (Docker Compose)

Services:
- `postgres`, `redis`, `api`, `web`, `nginx`.

Minimal steps:
1. Install Node 20 LTS + Docker Desktop.
2. `Copy-Item .env.example .env`
3. `docker compose up -d --build`
4. Open `http://localhost`

Seed:
- `apps/api/prisma/seed.ts` creates first admin user (`+79990000000`).

### H) CI/CD pipeline (already scaffolded)

In `.github/workflows/ci-cd.yml`:
- Build + type check.
- SAST (Semgrep).
- Dependency scan (`npm audit`).
- Container scan (Trivy).
- Deploy over SSH on `main`.

Recommended production deploy strategy:
- Blue/green with two compose projects or tagged release rollback.
- Migration step before traffic switch.
- Auto rollback if healthcheck fails.

### I) Server infrastructure hardening checklist

OS (Ubuntu 22.04):
- Non-root deploy user + SSH keys only.
- Disable password SSH login.
- `ufw`: allow only `22/80/443`.
- `fail2ban` for SSH + Nginx.
- Auto security updates.

Edge:
- Nginx reverse proxy.
- TLS (Let's Encrypt), HSTS, secure headers.
- Basic WAF rules (ModSecurity/OWASP CRS in phase 2).

Secrets:
- Start: `.env` on server with strict perms.
- Next: Vault/SSM/1Password Secrets Automation.

Backups and DR:
- Daily PostgreSQL dumps + encrypted offsite copy.
- Upload directory snapshot daily.
- RPO <= 24h, RTO <= 4h (starter target).
- Monthly restore drill.

Observability:
- Metrics: Prometheus + Grafana.
- Logs: Loki/ELK centralized.
- Alerts: CPU, RAM, disk, error rate, auth anomaly, failed backups.

---

## 7) Compliance Checklist RF (for IP operator)

### J) Legal/process checklist (requires lawyer + IB validation)

Mandatory documents/processes:
- Privacy policy (RU/EN).
- Personal data processing policy (152-FZ scope).
- Consent forms (registration, communications, optional marketing).
- Data subject request procedure (access/correction/deletion/restriction).
- Data retention and deletion schedule.
- Incident response regulation (roles, timelines, evidence handling).
- Access control regulation and admin action journal.
- Processor agreements (if using external SMS/cloud providers).

Operational controls:
- Data localization for RU citizens where required.
- Registry notifications and updates to regulator when required.
- 180-day audit/security logs retention (confirmed).
- SLA for handling data subject requests.
- Controlled cross-border transfer decisions.

Risk zones for your case:
- Phone numbers + message metadata = personal data.
- Logs may contain identifiers; must be minimized and access-controlled.
- Attachments can include biometric/sensitive content; policy and moderation workflow needed.
- Cross-border services (even SMS provider routing) may trigger transfer/legal obligations.

Where to verify latest legal wording (official):
- Official legal acts portal: https://pravo.gov.ru/
- Roskomnadzor personal data portal: https://pd.rkn.gov.ru/
- Roskomnadzor main site: https://rkn.gov.ru/

Important:
- Laws and fines are updated. Before launch, verify latest editions and effective dates on official sources above with legal counsel.

---

## 8) Reality / Limits / Risk Reduction

### K) What cannot be guaranteed

Cannot guarantee:
- "Absolute unhackability".
- Zero-day immunity.
- Zero data leakage under any scenario.

Can significantly reduce risk by:
- Defense-in-depth (app + infra + process).
- Strict key/session controls.
- Continuous security testing and patching.
- Backup/DR drills.
- Operational discipline and auditability.

---

## 9) Remaining Clarifying Questions Before Full Build-Out

### L) Questions to lock final design

1. Do you accept phase split: private E2EE first, group E2EE second?
2. Is PWA required in MVP or after launch?
3. Which exact Timeweb plan/resources will be used at first deploy?
4. Do you need username handles (`@name`) in MVP?
5. Should phone numbers be hidden by default in group chats?
6. Do you want message retention controls (auto-delete by time)?
7. Which SMS provider account will be used for RU traffic (final contract)?


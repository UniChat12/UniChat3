# Anfeelgram

Secure web messenger foundation (Telegram-like feature set roadmap) for RU/CIS launch.

## Current status

This repository includes:
- Monorepo (`apps/api`, `apps/web`)
- API with phone OTP auth, cloud password, refresh sessions, chats, messages, image attachments, reports, bans
- PostgreSQL + Redis + Nginx via Docker Compose
- CI/CD pipeline template with build, SAST, dependency scan, container scan, SSH deploy
- Compliance and security blueprint in `docs/blueprint.md`
- Mock OTP mode for local development (any code is accepted when enabled)

## Tech stack (implemented baseline)

- Backend: Fastify + TypeScript + Prisma + PostgreSQL + Redis
- Frontend: React + Vite (web)
- Infra: Docker Compose, Nginx reverse proxy

## Local run

1. Install Docker + Docker Compose plugin.
2. Copy env example:
   - PowerShell: `Copy-Item .env.example .env`
3. Start:
   - `docker compose up -d --build`
4. Open:
   - Web: `http://localhost`
   - API health: `http://localhost/api/health`

Local auth defaults:
- `OTP_ALLOW_ANY_CODE=true`
- `SMS_PROVIDER=mock`
- Any OTP code in `/auth/verify-otp` will pass in this mode.

## API quick flow

1. `POST /api/v1/auth/request-otp` with `{ "phone": "+79990000000" }`
2. In mock mode OTP is returned in response (`otpDebug`) and any code is accepted.
3. `POST /api/v1/auth/verify-otp` with phone + code.
4. Use `accessToken` in `Authorization: Bearer <token>`.

## Security notes

- No guarantee of "unhackable" system.
- This is a secure baseline, hardening required before public launch.
- Apply OS hardening, WAF, backups, incident response, legal controls.

## Branching and commits

- Branches:
  - `main` (production)
  - `develop` (integration)
  - `feature/<name>`
  - `hotfix/<name>`
- Conventional Commits:
  - `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, `security:`

## Next implementation priority

1. WebSocket realtime delivery + read receipts.
2. Group E2EE protocol layer.
3. Push notifications (Web Push + worker).
4. Advanced anti-spam and moderation workflows.
5. Full integration tests and load testing.

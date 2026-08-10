# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app

COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm install

COPY . .
RUN npm run prisma:generate -w apps/api && npm run build -w apps/api

EXPOSE 4000
CMD ["sh", "-c", "npm run prisma:db:push -w apps/api && npm run start -w apps/api"]

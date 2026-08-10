FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm install

COPY . .
RUN npm run build -w apps/web

FROM nginx:1.27-alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

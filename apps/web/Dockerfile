# apps/web/Dockerfile
# Standalone Next.js image — independent from apps/agent.
# Intended for local Docker Compose dev; production web deploy is Vercel.
FROM node:20-slim AS base
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm ci --workspace=apps/web --workspace=packages/shared-types --include-workspace-root

COPY apps/web apps/web
COPY packages/shared-types packages/shared-types

WORKDIR /repo/apps/web

EXPOSE 3000

CMD ["npm", "run", "dev"]

FROM node:22-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/core/package.json ./packages/core/
COPY apps/api/package.json ./apps/api/

RUN npm install --workspace=@tim/api --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

EXPOSE 3001

CMD ["npx", "tsx", "apps/api/src/index.ts"]

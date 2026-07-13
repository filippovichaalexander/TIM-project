FROM node:22-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/core/package.json ./packages/core/
COPY apps/web/package.json ./apps/web/

RUN npm install --workspace=@tim/web --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

EXPOSE 5173

CMD ["npm", "run", "dev", "--workspace=@tim/web", "--", "--host", "0.0.0.0"]

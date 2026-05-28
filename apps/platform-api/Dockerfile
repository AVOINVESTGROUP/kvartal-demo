FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/platform-api/package.json apps/platform-api/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/config/tsconfig.base.json packages/config/tsconfig.base.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/platform-api apps/platform-api
COPY packages packages
RUN pnpm --filter @kvartal/platform-api build

FROM node:20-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/apps/platform-api/dist ./dist
CMD ["node", "dist/index.js"]

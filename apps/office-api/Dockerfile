FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/office-api/package.json apps/office-api/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/property-identity/package.json packages/property-identity/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/config/tsconfig.base.json packages/config/tsconfig.base.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/office-api apps/office-api
COPY packages packages
RUN pnpm --filter @kvartal/db prisma:generate
RUN pnpm --filter @kvartal/auth build
RUN pnpm --filter @kvartal/property-identity build
RUN pnpm --filter @kvartal/office-api build

FROM node:20-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/office-api/node_modules ./apps/office-api/node_modules
COPY --from=build /app/apps/office-api/dist ./apps/office-api/dist
COPY --from=build /app/packages/auth/package.json ./packages/auth/package.json
COPY --from=build /app/packages/auth/dist ./packages/auth/dist
COPY --from=build /app/packages/auth/node_modules ./packages/auth/node_modules
COPY --from=build /app/packages/property-identity/package.json ./packages/property-identity/package.json
COPY --from=build /app/packages/property-identity/dist ./packages/property-identity/dist
CMD ["node", "apps/office-api/dist/index.js"]

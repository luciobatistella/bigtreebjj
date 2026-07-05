FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
RUN corepack enable && pnpm install --ignore-scripts
COPY . .
RUN pnpm --filter @thebigtreebjj/database prisma:generate
EXPOSE 3001
CMD ["pnpm", "--filter", "@thebigtreebjj/api", "dev"]

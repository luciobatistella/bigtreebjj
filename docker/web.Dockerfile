FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
RUN corepack enable && pnpm install --ignore-scripts
COPY . .
EXPOSE 3000
CMD ["pnpm", "--filter", "@thebigtreebjj/web", "dev"]

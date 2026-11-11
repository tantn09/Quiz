FROM node:22-alpine
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY quiz-fe/package.json quiz-fe/package.json
COPY quiz-be/package.json quiz-be/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @quiz/web build
EXPOSE 3000
CMD ["pnpm", "--filter", "@quiz/web", "start"]

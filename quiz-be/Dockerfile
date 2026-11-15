FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY quiz-fe/package.json quiz-fe/package.json
COPY quiz-be/package.json quiz-be/package.json
RUN pnpm install --frozen-lockfile
COPY quiz-be/ quiz-be/
RUN pnpm --filter @quiz/api build && pnpm --filter @quiz/api deploy --legacy --prod /deploy

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /workspace/quiz-be
COPY --from=build /deploy ./
COPY --from=build /workspace/quiz-be/dist ./dist
EXPOSE 4000
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]

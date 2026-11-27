FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY quiz-fe/package.json quiz-fe/package.json
COPY quiz-be/package.json quiz-be/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @quiz/web build

FROM node:22-alpine
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /workspace
COPY --from=build /workspace/quiz-fe/.next/standalone ./
COPY --from=build /workspace/quiz-fe/.next/static ./quiz-fe/.next/static
COPY --from=build /workspace/quiz-fe/public ./quiz-fe/public
EXPOSE 3000
CMD ["node", "quiz-fe/server.js"]

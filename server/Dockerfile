FROM oven/bun:1.3

WORKDIR /app

COPY server/package.json server/bun.lock ./server/
COPY shared/ ./shared/

WORKDIR /app/server
RUN bun install --frozen-lockfile

COPY server/index.ts ./

ENV PORT=8080
EXPOSE 8080

CMD ["bun", "run", "index.ts"]

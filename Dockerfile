# Strauss Car Advisor: one container serves the API and the built client.
# Build:  docker build -t strauss-car-advisor .
# Run:    docker run -p 8080:8080 --env-file .env.production strauss-car-advisor

# --- build: client (dist/) and bundled server (dist-server/) ---
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- runtime: production dependencies only ---
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    DATA_DIR=/app/.data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
# Local file storage is used only without Supabase; mount a volume on /app/.data in that case
RUN mkdir -p /app/.data && chown node:node /app/.data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist-server/index.mjs"]

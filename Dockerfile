FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY web/package.json web/package.json

# Use install (not ci) so Docker builds don't fail when package-lock is temporarily out of sync
# during iterative development.
RUN npm install --no-audit --no-fund

FROM deps AS backend
WORKDIR /app
COPY backend backend
EXPOSE 4000
CMD ["npm", "run", "dev:watch", "--workspace", "backend"]

FROM deps AS web
WORKDIR /app
COPY web web
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace", "web", "--", "--host", "0.0.0.0", "--strictPort"]

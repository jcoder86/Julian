# ─── stage 1: build ────────────────────────────────────────────────────
# Run vite build in a Node 22 alpine container. Generates dist/ with
# bundled JS + all assets + the service worker / manifest.
FROM node:22-alpine AS builder

WORKDIR /build

# Cache npm install layer on dependency-only changes.
COPY package.json package-lock.json ./
RUN npm ci

# Source + assets + build config.
COPY index.html vite.config.js ./
COPY src ./src
COPY assets ./assets
COPY scripts ./scripts

# Produces dist/ (prune script in the build npm-script drops unused
# raw/ source images, halving the bundle).
RUN npm run build


# ─── stage 2: runtime ──────────────────────────────────────────────────
# nginx:alpine serves the static build. ~24 MB final image.
FROM nginx:alpine

# Custom nginx config: SPA-style fallback (everything not on disk -> index.html),
# explicit mime-types for our audio + video formats, sensible cache headers.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The built site itself.
COPY --from=builder /build/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

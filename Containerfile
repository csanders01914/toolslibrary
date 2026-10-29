# ToolsLibrary - A self-hostable, zero-PII tool library and skill-sharing platform built for local communities.
# Copyright (C) 2026  Chris Sanders
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

# Containerfile — multi-stage rootless-Podman image for the Tool Library.
# Target host: Fedora CoreOS, rootless Podman with --userns=keep-id.
# Stack: Next.js 15 App Router with `output: 'standalone'` (see next.config.ts),
# Prisma 5.22 + SQLite (WAL) on a bind-mounted volume, bcryptjs (pure JS — no
# native toolchain needed on Alpine).
# Local host artifacts (secrets, live database, editor backups) are kept out of
# the build context by .dockerignore — this file never touches host source.

# ---- base: shared foundation for all stages --------------------------------
FROM node:20-alpine AS base
WORKDIR /app
# openssl: Prisma query-engine runtime dependency on musl;
# libc6-compat: glibc compatibility shims some npm binaries expect.
RUN apk add --no-cache openssl libc6-compat

# ---- deps: deterministic, lockfile-driven dependency install ---------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: TypeScript compilation + Prisma client generation ------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time placeholder only; the real database lives exclusively in the
# runtime volume mounted at /app/data (never copied into the image).
ENV DATABASE_URL="file:/app/data/tool_library.db"
ENV NEXT_TELEMETRY_DISABLED=1
# Optional funding surface (PHASE_27_SUSTAINABILITY_DOCS): the operator's
# Liberapay page URL, surfaced in the site footer. Prerendered pages bake the
# build-time value; dynamic pages read the runtime ENV below. Empty by
# default — the footer link simply does not render until the operator sets
# their real Liberapay URL (no placeholder URLs ship in the UI).
ARG LIBERAPAY_URL=""
ENV LIBERAPAY_URL=${LIBERAPAY_URL}
# `npm run build` == `prisma generate && next build` (see package.json),
# which compiles TypeScript and emits .next/standalone.
RUN npm run build

# ---- runner: minimal standalone production image ---------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/data/tool_library.db"
# Runtime half of the builder-stage LIBERAPAY_URL (dynamic pages read it at
# request time; see the builder stage comment).
ARG LIBERAPAY_URL=""
ENV LIBERAPAY_URL=${LIBERAPAY_URL}

# The Prisma CLI is a devDependency, so it is NOT part of the standalone
# bundle. Install it BEFORE the standalone COPY below: the traced
# node_modules from .next/standalone then overlays (merges with) this layer
# instead of npm pruning it. Order matters.
RUN npm install --no-save prisma@5.22.0 \
    && mkdir -p /app/data/uploads \
    && chown -R node:node /app

USER node
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/prisma ./prisma

# OCI metadata (AGPLv3 compliance visibility).
LABEL org.opencontainers.image.title="tool-library" \
      org.opencontainers.image.description="Zero-PII community tool & skills library (Next.js standalone + Prisma/SQLite)" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.source="https://github.com/csanders01914/toolslibrary"

# Liveness probe: the landing page is force-dynamic and touches the database,
# so a 200 here proves both the server and the SQLite volume are healthy.
# Shell form is intentional so ${PORT} resolves at container runtime.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${PORT:-3000}/" || exit 1

EXPOSE 3000
# Apply version-controlled SQL migrations (prisma/migrations/*.sql) to the
# WAL-mode SQLite volume, then boot the standalone server. `migrate deploy`
# applies pending migrations sequentially and never destroys data; schema
# drift fails loudly instead of being force-synced (unlike `db push`, a
# prototyping command that can silently truncate or drop columns). The
# Prisma client is generated at build time in the builder stage; `migrate
# deploy` never regenerates it. Existing databases created by `db push` must
# be baselined once: prisma migrate resolve --applied 0_init (see
# DEPLOYMENT.md).
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node server.js"]

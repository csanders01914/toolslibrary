/*
 * ToolsLibrary - A self-hostable, zero-PII tool library and skill-sharing platform built for local communities.
 * Copyright (C) 2026  Chris Sanders
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // @node-rs/bcrypt and @node-rs/argon2 are native NAPI modules (PHASE_48
  // bcryptjs swap; Stage 1 of the KILO auth/security plan added Argon2id):
  // keep them external to the server bundle so the prebuilt .node binaries
  // are loaded from node_modules at runtime instead of being traced/bundled
  // by webpack.
  serverExternalPackages: ['@node-rs/bcrypt', '@node-rs/argon2'],
  // Server Actions carry the tool-listing photo on /tools/[id]/edit. The
  // default 1MB body limit rejects virtually every real phone photo (2-8MB)
  // with a silent 413 before updateTool runs, so the limit is raised above
  // the 5MB client-validated image cap plus multipart field overhead.
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
      // Cloudflare tunnel: the browser sends the public site in the Origin
      // header while the container serves on an internal host, so the Server
      // Actions CSRF origin check rejects every action POST with 403
      // ("x-forwarded-host" mismatch). Allowlist the public deployment
      // origins — bare hostnames, no scheme, as Next matches them against
      // the Origin header's host component.
      allowedOrigins: ['www.tools-library.com', 'tools-library.com'],
    },
  },
  // Pin workspace tracing to this repository so a stray lockfile in a parent
  // directory cannot pull build traces from outside the project.
  outputFileTracingRoot: path.join(__dirname),
  // Referrer-Policy: cross-origin navigations leak only the origin, never a
  // full URL — so path-borne secrets (e.g. the PHASE_30 single-use canary
  // confirmation token) cannot reach third-party edge infrastructure via a
  // Referer header. Browsers default to strict-origin-when-cross-origin, but
  // the header is pinned so older or misconfigured clients cannot regress it.
  //
  // PHASE_49 (audit S8): the app previously shipped ONLY the Referrer-Policy.
  // Added: nosniff, framing denial (X-Frame-Options + frame-ancestors), HSTS
  // (TLS terminates at Caddy on the FCOS host; the header is applied at the
  // app so it survives any proxy path), and a baseline CSP. The CSP allows
  // 'unsafe-inline' for script/style because Next.js hydration and the
  // design system's inline style attributes require it; it still locks the
  // app to same-origin resources (zero external CDNs by contract), forbids
  // plugins/embedding, and pins form-action and base-uri to self.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

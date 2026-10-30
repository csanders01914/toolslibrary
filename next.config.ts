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
  // Server Actions carry the tool-listing photo on /tools/[id]/edit. The
  // default 1MB body limit rejects virtually every real phone photo (2-8MB)
  // with a silent 413 before updateTool runs, so the limit is raised above
  // the 5MB client-validated image cap plus multipart field overhead.
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
  // Pin workspace tracing to this repository so a stray lockfile in a parent
  // directory cannot pull build traces from outside the project.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;

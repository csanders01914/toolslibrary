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

import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { prisma } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const safeFilename = path.basename(filename);

  // SEC_REVIEW_MEDIUM_2_PATH_TRAVERSAL: validate filename against the same
  // allowlist used by the deletion helpers (uploads.ts:189) before any
  // filesystem access. Rejects path traversal attempts (.., slashes) and
  // any characters outside the system-generated CSPRNG filename alphabet.
  if (!/^[a-zA-Z0-9._-]+$/.test(safeFilename)) {
    return new NextResponse('File not found', { status: 404 });
  }

  // PHASE_47 (audit S1): this route serves PUBLIC listing photos only. A file
  // is served only when an existing Tool.imageUrl references exactly this
  // filename — secret-link images (PublishedImage) live in an isolated
  // data/uploads/secret/ directory and are reachable exclusively at
  // /i/<token>, never here.
  const tool = await prisma.tool.findFirst({
    where: { imageUrl: safeFilename },
    select: { id: true },
  });
  if (!tool) {
    return new NextResponse('File not found', { status: 404 });
  }

  const filePath = path.resolve(process.cwd(), 'data/uploads', safeFilename);

  // PHASE_53 (audit P1): async stat + streamed response — the hot image path
  // no longer blocks the event loop with synchronous fs calls, and the bytes
  // flow to the socket instead of being buffered whole in RAM first.
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    return new NextResponse('File not found', { status: 404 });
  }

  const ext = path.extname(safeFilename).toLowerCase();

  // PHASE_49 (audit S7): the .svg mapping is gone — the upload pipeline can
  // never produce an .svg file (uploads.ts derives extensions from the
  // validated MIME allowlist only), and serving a foreign .svg dropped into
  // the directory would be a stored-XSS surface. Unknown extensions fall
  // through to application/octet-stream, which browsers refuse to render.
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';

  return new NextResponse(Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(fileStat.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
      // PHASE_49 (audit S8): never MIME-sniff the response into execution.
      // (The global CSP from next.config.ts also applies to this route —
      // next.config headers() override a route-level CSP of the same name —
      // so the sandboxing CSP is deliberately set there, once, app-wide.)
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
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

import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

// Regenerated on every request so newly listed tools and skills are picked up
// without a rebuild.
export const dynamic = "force-dynamic";

// Canonical public origin — same fallback chain as src/auth.config.ts.
// Trailing slashes are stripped so joined URLs stay clean.
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.tools-library.com"
).replace(/\/+$/, "");

// Public, indexable content routes only. Auth-gated surfaces (dashboard,
// messages, admin console, listing/edit forms) and account flows are
// deliberately excluded: they are private or noise for crawlers.
const staticEntries: MetadataRoute.Sitemap = [
  { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
  { url: `${SITE_URL}/tools`, changeFrequency: "weekly", priority: 0.9 },
  { url: `${SITE_URL}/skills`, changeFrequency: "weekly", priority: 0.9 },
  { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE_URL}/help`, changeFrequency: "monthly", priority: 0.6 },
  { url: `${SITE_URL}/contribute`, changeFrequency: "monthly", priority: 0.6 },
  { url: `${SITE_URL}/donate`, changeFrequency: "monthly", priority: 0.6 },
  { url: `${SITE_URL}/code-of-conduct`, changeFrequency: "yearly", priority: 0.5 },
  { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.5 },
  { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.5 },
  { url: `${SITE_URL}/transparency`, changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE_URL}/accessibility`, changeFrequency: "yearly", priority: 0.5 },
  { url: `${SITE_URL}/matrix-chat`, changeFrequency: "yearly", priority: 0.5 },
  { url: `${SITE_URL}/discord-chat`, changeFrequency: "yearly", priority: 0.5 },
  { url: `${SITE_URL}/sitemap`, changeFrequency: "weekly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tools, skills] = await Promise.all([
    prisma.tool.findMany({
      select: { id: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.skill.findMany({
      select: { id: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return [
    ...staticEntries,
    ...tools.map((tool) => ({
      url: `${SITE_URL}/tools/${tool.id}`,
      lastModified: tool.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...skills.map((skill) => ({
      url: `${SITE_URL}/skills/${skill.id}`,
      lastModified: skill.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}

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

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getUserImages } from "@/lib/actions/images";
import ImagesClient from "./ImagesClient";

export const dynamic = "force-dynamic";

/**
 * Management dashboard for secret-link images: every image the signed-in
 * operator has published, with its title, full share URL, and delete control.
 * /dashboard/* is already middleware-gated; the explicit session check keeps
 * the page safe when rendered outside the middleware path (e.g. direct RSC
 * navigation) and matches the other dashboard pages' contract.
 *
 * ADMIN-only (operator directive, 2026-11-08): secret-link publishing is an
 * operator surface, not a member feature — general members are redirected to
 * /dashboard, and the only entry point is the admin console (/admin). The
 * REST route /api/images/create carries the same role gate.
 *
 * The share URLs are assembled server-side from the request's host headers
 * (x-forwarded-host first, as set by the trusted edge) so the dashboard shows
 * the exact absolute URL a recipient must open — display only; the token
 * itself is the secret.
 */
export default async function ImagesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [images, h] = await Promise.all([getUserImages(session.user.id), headers()]);

  const host =
    h.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    h.get("host") ||
    "localhost:3000";
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const origin = `${proto}://${host}`;

  return (
    <ImagesClient
      images={images.map((image) => ({
        id: image.id,
        title: image.title,
        url: `${origin}/i/${image.token}`,
        createdAt: image.createdAt,
      }))}
    />
  );
}

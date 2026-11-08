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
import NewImageClient from "./NewImageClient";

export const dynamic = "force-dynamic";

/**
 * Publish surface for secret-link images: pick a file, give it an
 * owner-facing title, and receive an unguessable /i/<token> URL that serves
 * nothing but the image. /dashboard/* is already middleware-gated; the
 * explicit session check keeps the page safe when rendered outside the
 * middleware path and matches the other dashboard pages' contract.
 */
export default async function NewImagePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return <NewImageClient />;
}

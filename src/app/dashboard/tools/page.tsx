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
import { getUserTools } from "@/lib/actions/tools";
import MyToolsClient from "./MyToolsClient";

export const dynamic = "force-dynamic";

/**
 * Dedicated management surface behind the dashboard's "Tools Offered" stat
 * card: every tool the signed-in member has listed, with add/delete control.
 * /dashboard/* is already middleware-gated; the explicit session check keeps
 * the page safe when rendered outside the middleware path (e.g. direct RSC
 * navigation) and matches the main dashboard page's contract.
 */
export default async function MyToolsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const tools = await getUserTools(session.user.id);

  return <MyToolsClient tools={tools} />;
}

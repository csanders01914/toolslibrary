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
import { getUserSkills } from "@/lib/actions/skills";
import MySkillsClient from "./MySkillsClient";

export const dynamic = "force-dynamic";

/**
 * Dedicated management surface behind the dashboard's "Skills Offered" stat
 * card: every skill the signed-in member has listed, with add/delete and
 * availability control. /dashboard/* is already middleware-gated; the
 * explicit session check matches the main dashboard page's contract.
 */
export default async function MySkillsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const skills = await getUserSkills(session.user.id);

  return <MySkillsClient skills={skills} />;
}

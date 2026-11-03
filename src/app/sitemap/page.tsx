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

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Compass,
  Hammer,
  HeartHandshake,
  ListTree,
  Map,
  Scale,
  UserRound,
  Wrench,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { CATEGORIES, SKILL_CATEGORIES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sitemap — ToolsLibrary",
  description:
    "Every public page on this ToolsLibrary instance, in one place: browse the inventory, the skill exchange, and all policy documents.",
};

interface PageLink {
  href: string;
  label: string;
}

const exploreLinks: PageLink[] = [
  { href: "/", label: "Home" },
  { href: "/tools", label: "Browse Tools" },
  { href: "/skills", label: "Browse Skills" },
  { href: "/about", label: "About / Manifesto" },
];

const communityLinks: PageLink[] = [
  { href: "/code-of-conduct", label: "Code of Conduct" },
  { href: "/contribute", label: "Contribute / Get Involved" },
  { href: "/donate", label: "Donate / Support Us" },
  { href: "/matrix-chat", label: "Matrix Chat" },
  { href: "/discord-chat", label: "Discord Chat" },
];

const legalLinks: PageLink[] = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/transparency", label: "Transparency Report" },
  { href: "/accessibility", label: "Accessibility Statement" },
  { href: "/help", label: "Request Help" },
];

const accountLinks: PageLink[] = [
  { href: "/login", label: "Log In" },
  { href: "/register", label: "Register" },
  { href: "/recover", label: "Recover Access" },
  { href: "/change-password", label: "Change Password" },
];

function SitemapSection({
  title,
  icon: Icon,
  links,
}: {
  title: string;
  icon: LucideIcon;
  links: PageLink[];
}) {
  return (
    <section className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 transition-colors hover:border-cyan-500/50">
      <h2 className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-zinc-400">
        <Icon className="h-4 w-4 text-cyan-400" aria-hidden="true" />
        {title}
      </h2>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CategoryGroup({
  category,
  items,
  hrefPrefix,
}: {
  category: string;
  items: { id: string; name: string }[];
  hrefPrefix: string;
}) {
  return (
    <div>
      <h3 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
        {category}
      </h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`${hrefPrefix}/${item.id}`}
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              {item.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function SitemapPage() {
  // Zero PII: only listing ids, names, and categories are read — no owner
  // aliases, locations, or trust scores are touched for this page.
  const [tools, skills] = await Promise.all([
    prisma.tool.findMany({
      select: { id: true, name: true, category: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.skill.findMany({
      select: { id: true, name: true, category: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  ]);

  const toolGroups = CATEGORIES.map((category) => ({
    category,
    items: tools.filter((tool) => tool.category === category),
  })).filter((group) => group.items.length > 0);
  const extraToolCategories = [
    ...new Set(
      tools
        .filter((tool) => !CATEGORIES.includes(tool.category))
        .map((tool) => tool.category)
    ),
  ].sort();

  const skillGroups = SKILL_CATEGORIES.map((category) => ({
    category,
    items: skills.filter((skill) => skill.category === category),
  })).filter((group) => group.items.length > 0);
  const extraSkillCategories = [
    ...new Set(
      skills
        .filter((skill) => !SKILL_CATEGORIES.includes(skill.category))
        .map((skill) => skill.category)
    ),
  ].sort();

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="py-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 border border-cyan-500/50 bg-cyan-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-400">
          <Map className="h-3.5 w-3.5" aria-hidden="true" />
          SITE DIRECTORY
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
          NAVIGATION // SITEMAP
        </p>
        <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">
          Sitemap
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400 sm:text-base leading-relaxed">
          Every public page on this instance, in one place. Member consoles
          (dashboard, messages, admin) are intentionally left out.
        </p>
      </section>

      {/* Static pages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <SitemapSection title="Explore" icon={Compass} links={exploreLinks} />
        <SitemapSection
          title="Community & Governance"
          icon={HeartHandshake}
          links={communityLinks}
        />
        <SitemapSection title="Legal & Policies" icon={Scale} links={legalLinks} />
        <SitemapSection title="Account" icon={UserRound} links={accountLinks} />
      </div>

      {/* Tool listings */}
      <section className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 sm:p-8">
        <h2 className="mb-6 flex flex-wrap items-center gap-2 text-xl font-bold text-white tracking-tight">
          <Wrench className="h-5 w-5 text-cyan-400" aria-hidden="true" />
          Tool Listings
          <span className="border border-zinc-700 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
            {tools.length} {tools.length === 1 ? "listing" : "listings"}
          </span>
        </h2>
        {tools.length === 0 ? (
          <p className="text-sm text-zinc-400">No tools listed yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {toolGroups.map((group) => (
              <CategoryGroup
                key={group.category}
                category={group.category}
                items={group.items}
                hrefPrefix="/tools"
              />
            ))}
            {extraToolCategories.map((category) => (
              <CategoryGroup
                key={category}
                category={category}
                items={tools.filter((tool) => tool.category === category)}
                hrefPrefix="/tools"
              />
            ))}
          </div>
        )}
      </section>

      {/* Skill listings */}
      <section className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 sm:p-8">
        <h2 className="mb-6 flex flex-wrap items-center gap-2 text-xl font-bold text-white tracking-tight">
          <Hammer className="h-5 w-5 text-purple-400" aria-hidden="true" />
          Skill Listings
          <span className="border border-zinc-700 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
            {skills.length} {skills.length === 1 ? "listing" : "listings"}
          </span>
        </h2>
        {skills.length === 0 ? (
          <p className="text-sm text-zinc-400">No skills listed yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {skillGroups.map((group) => (
              <CategoryGroup
                key={group.category}
                category={group.category}
                items={group.items}
                hrefPrefix="/skills"
              />
            ))}
            {extraSkillCategories.map((category) => (
              <CategoryGroup
                key={category}
                category={category}
                items={skills.filter((skill) => skill.category === category)}
                hrefPrefix="/skills"
              />
            ))}
          </div>
        )}
      </section>

      {/* Machine-readable copy */}
      <p className="flex items-center justify-center gap-2 font-mono text-[11px] text-zinc-500">
        <ListTree className="h-3.5 w-3.5" aria-hidden="true" />
        Search engines: a machine-readable copy is served at{" "}
        <Link
          href="/sitemap.xml"
          className="text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          /sitemap.xml
        </Link>
        .
      </p>
    </div>
  );
}

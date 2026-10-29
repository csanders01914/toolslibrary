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
  Github,
  Scale,
  ShieldCheck,
  FileText,
  Activity,
  HeartHandshake,
  Code2,
  Heart,
  MessageCircle,
  MessagesSquare,
  BookOpen,
  Info,
  ExternalLink,
  LifeBuoy,
} from "lucide-react";

const sourceLicenseLinks = [
  {
    href: "https://github.com/csanders01914/toolslibrary",
    label: "Source Code (GitHub)",
    icon: Github,
    external: true,
  },
  {
    href: "https://www.gnu.org/licenses/agpl-3.0.html",
    label: "GNU AGPLv3 License",
    icon: Scale,
    external: true,
  },
];

const privacyLegalLinks = [
  { href: "/privacy", label: "Privacy Policy", icon: ShieldCheck },
  { href: "/terms", label: "Terms of Service", icon: FileText },
  { href: "/transparency", label: "Transparency Report", icon: Activity },
  { href: "/help", label: "Request Help", icon: LifeBuoy },
];

const communityLinks = [
  { href: "/code-of-conduct", label: "Code of Conduct", icon: HeartHandshake },
  { href: "/contribute", label: "Contribute / Get Involved", icon: Code2 },
  { href: "/donate", label: "Donate / Support Us", icon: Heart },
  // Operator's Liberapay page (PHASE_27_SUSTAINABILITY_DOCS): rendered only
  // when LIBERAPAY_URL is configured at build/deploy time — never a fake or
  // placeholder URL.
  ...(process.env.LIBERAPAY_URL?.trim()
    ? [
        {
          href: process.env.LIBERAPAY_URL.trim(),
          label: "Support on Liberapay",
          icon: Heart,
          external: true,
        },
      ]
    : []),
  {
    href: "/matrix-chat",
    label: "Matrix Chat",
    icon: MessagesSquare,
  },
  {
    href: "/discord-chat",
    label: "Discord Chat",
    icon: MessageCircle,
  },
];

const navigationLinks = [
  { href: "/about", label: "About / Manifesto", icon: Info },
  {
    href: "http://wiki.tools-library.com",
    label: "Project Wiki",
    icon: BookOpen,
    external: true,
  },
];

function FooterLink({
  href,
  label,
  icon: Icon,
  external = false,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
}) {
  const isExternal = external || href.startsWith("http");
  const className =
    "group flex items-center gap-2 py-1.5 font-mono text-[11px] text-zinc-500 hover:text-white active:text-white transition-colors";
  const inner = (
    <>
      <Icon className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" aria-hidden="true" />
      <span>{label}</span>
      {isExternal && (
        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
      )}
    </>
  );
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

function FooterColumn({
  title,
  badge,
  badgeClasses,
  children,
}: {
  title: string;
  badge?: string;
  badgeClasses?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-4 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-widest text-zinc-400">
        {title}
        {badge && (
          <span
            className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${badgeClasses ?? "border-cyan-500/50 bg-cyan-500/5 text-cyan-400"}`}
          >
            {badge}
          </span>
        )}
      </h3>
      <ul className="space-y-3">{children}</ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-black border-t border-zinc-800 mt-20 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Column 1: Source & License */}
          <FooterColumn
            title="Source & License"
            badge="AGPLv3"
            badgeClasses="border-emerald-500/50 bg-emerald-500/5 text-emerald-400"
          >
            {sourceLicenseLinks.map((link) => (
              <li key={link.href}>
                <FooterLink {...link} />
              </li>
            ))}
            <li className="pt-2 font-mono text-[11px] leading-relaxed text-zinc-500">
              This project is free software under GNU AGPLv3. Section 13 requires that the full
              corresponding source of this network service remains available to every user.
            </li>
          </FooterColumn>

          {/* Column 2: Privacy & Legal */}
          <FooterColumn
            title="Privacy & Legal"
            badge="Zero-PII"
            badgeClasses="border-emerald-500/50 bg-emerald-500/5 text-emerald-400"
          >
            {privacyLegalLinks.map((link) => (
              <li key={link.href}>
                <FooterLink {...link} />
              </li>
            ))}
            <li className="pt-2 font-mono text-[11px] leading-relaxed text-zinc-500">
              No emails, no phone numbers, no IP logging, no analytics, and no third-party
              trackers.
            </li>
          </FooterColumn>

          {/* Column 3: Community & Governance */}
          <FooterColumn title="Community & Governance">
            {communityLinks.map((link) => (
              <li key={link.href}>
                <FooterLink {...link} />
              </li>
            ))}
          </FooterColumn>

          {/* Column 4: Navigation & Knowledge */}
          <FooterColumn title="Navigation & Knowledge">
            {navigationLinks.map((link) => (
              <li key={link.href}>
                <FooterLink {...link} />
              </li>
            ))}
            <li className="pt-2 font-mono text-[11px] leading-relaxed text-zinc-500">
              The Project Wiki runs on a self-hosted, standalone LeafWiki instance at
              wiki.tools-library.com. No third-party knowledge platform is involved.
            </li>
          </FooterColumn>
        </div>

        <div className="mt-12 border-t border-zinc-900 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-center font-mono text-[11px] text-zinc-500 sm:text-left">
            © {new Date().getFullYear()} Tool Library Collective, licensed under GNU AGPLv3.
            Built for mutual aid and right to repair.
          </p>
          <p className="font-mono text-[11px] text-zinc-600">
            Self-hosted on Fedora CoreOS · Rootless Podman · Zero telemetry
          </p>
          <Link href="/accessibility" aria-label="WCAG 2.2 Level AAA accessibility statement">
            <img
              src="/wcag2.2-aaa.png"
              alt="WCAG 2.2 Level AAA"
              width={110}
              height={39}
              className="opacity-90 hover:opacity-100 transition-opacity"
            />
          </Link>
        </div>
      </div>
    </footer>
  );
}

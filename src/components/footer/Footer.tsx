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
} from "lucide-react";

const sourceLicenseLinks = [
  {
    href: "https://github.com/csanders01914/tool-library",
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
];

const communityLinks = [
  { href: "/code-of-conduct", label: "Code of Conduct", icon: HeartHandshake },
  { href: "/contribute", label: "Contribute / Get Involved", icon: Code2 },
  { href: "/donate", label: "Donate / Support Us", icon: Heart },
  {
    href: "https://matrix.to/#/#tools-library:matrix.org",
    label: "Matrix Chat",
    icon: MessagesSquare,
    external: true,
  },
];

const navigationLinks = [
  { href: "/about", label: "About / Manifesto", icon: Info },
  {
    href: "https://wiki.tools-library.com",
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
    "group flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-300 transition-colors duration-200";
  const inner = (
    <>
      <Icon className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors duration-200" aria-hidden="true" />
      <span>{label}</span>
      {isExternal && (
        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" aria-hidden="true" />
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
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 mb-4 flex items-center gap-2 flex-wrap">
        {title}
        {badge && (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeClasses ?? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"}`}
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
    <footer className="bg-slate-950/90 backdrop-blur-xl border-t border-white/10 mt-20 relative z-10">
      <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" aria-hidden="true" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Column 1: Source & License */}
          <FooterColumn
            title="Source & License"
            badge="AGPLv3"
            badgeClasses="bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
          >
            {sourceLicenseLinks.map((link) => (
              <li key={link.href}>
                <FooterLink {...link} />
              </li>
            ))}
            <li className="pt-2 text-xs text-slate-500 leading-relaxed">
              This project is free software under GNU AGPLv3. Section 13 requires that the full
              corresponding source of this network service remains available to every user.
            </li>
          </FooterColumn>

          {/* Column 2: Privacy & Legal */}
          <FooterColumn
            title="Privacy & Legal"
            badge="Zero-PII"
            badgeClasses="bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
          >
            {privacyLegalLinks.map((link) => (
              <li key={link.href}>
                <FooterLink {...link} />
              </li>
            ))}
            <li className="pt-2 text-xs text-slate-500 leading-relaxed">
              No emails. No phone numbers. No IP logging. No analytics. No third-party trackers.
              Ever.
            </li>
          </FooterColumn>

          {/* Column 3: Community & Governance */}
          <FooterColumn title="Community & Governance">
            {communityLinks.map((link) => (
              <li key={link.href}>
                <FooterLink {...link} />
              </li>
            ))}
            <li>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.25)]">
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                Discord (Coming Soon)
              </span>
            </li>
          </FooterColumn>

          {/* Column 4: Navigation & Knowledge */}
          <FooterColumn title="Navigation & Knowledge">
            {navigationLinks.map((link) => (
              <li key={link.href}>
                <FooterLink {...link} />
              </li>
            ))}
            <li className="pt-2 text-xs text-slate-500 leading-relaxed">
              The Project Wiki runs on a self-hosted, standalone BookStack instance at
              wiki.tools-library.com — no third-party knowledge platforms involved.
            </li>
          </FooterColumn>
        </div>

        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500 text-center sm:text-left">
            © {new Date().getFullYear()} Tool Library Collective — Licensed under GNU AGPLv3.
            Built for mutual aid, right-to-repair, and local resilience.
          </p>
          <p className="text-xs text-slate-600 font-mono">
            Self-hosted on Fedora CoreOS · Rootless Podman · Zero telemetry
          </p>
        </div>
      </div>
    </footer>
  );
}

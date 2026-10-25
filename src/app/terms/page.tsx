import Link from "next/link";
import { FileText, Wrench, ShieldAlert, Scale, Users, Gavel } from "lucide-react";

export const metadata = {
  title: "Terms of Service — Tool Library",
  description: "Good-faith peer lending, tool safety responsibility, and anti-abuse rules.",
};

const sections = [
  {
    icon: Users,
    color: "cyan",
    title: "1. The Spirit of the Agreement",
    body: "Tool Library is a mutual-aid platform for neighbors to lend tools and exchange skills. By creating an account you agree to participate in good faith: describe your listings honestly, honor the loan commitments you accept, and treat other members with respect. This is a community contract, not a commercial one — no fees are charged and no purchases occur.",
  },
  {
    icon: Wrench,
    color: "emerald",
    title: "2. Tool Safety & Responsibility",
    body: "Tools are physical objects with real hazards. Borrowers agree to inspect a tool before use, operate it only for its intended purpose, and follow all manufacturer safety guidance. Lenders agree to disclose known defects and to keep listed tools in safe working condition. The platform facilitates introductions; it does not inspect, warrant, or certify any tool. Each member is responsible for their own safety decisions.",
  },
  {
    icon: ShieldAlert,
    color: "rose",
    title: "3. Loan Obligations & Trust Consequences",
    body: "When an owner approves your loan request, you are expected to return the tool on the agreed date and in the condition received. Returning on time in good condition raises your Trust Score by +5. Damaged or overdue returns lower it by −15. Trust Scores are visible to other members and gate the community's willingness to lend to you. Repeated abuse may result in account suspension by an administrator.",
  },
  {
    icon: Scale,
    color: "purple",
    title: "4. Acceptable Content & Listings",
    body: "Listings, skills, messages, and profile content must be lawful and relevant to the community's purpose. Prohibited: weapons designed to harm people, illegal items, counterfeit goods, harassment, spam, doxxing attempts, and content that would violate the Code of Conduct. Administrators may remove listings and suspend accounts that violate these rules.",
  },
  {
    icon: Gavel,
    color: "cyan",
    title: "5. Liability, License & Governing Terms",
    body: "The service is provided \"as is\" without warranties of any kind. To the maximum extent permitted by law, the operators and contributors are not liable for injuries, damages, or losses arising from tool use or member interactions. The software itself is licensed under the GNU Affero General Public License v3; these terms govern your use of the running service, while the AGPLv3 governs the source code. Disputes between members are expected to be resolved directly and in good faith — the platform stores no contact information and cannot arbitrate on your behalf.",
  },
];

const colorMap: Record<string, { badge: string; border: string; text: string }> = {
  cyan: {
    badge: "border-cyan-500/50 bg-cyan-500/5 text-cyan-400",
    border: "hover:border-cyan-500/50",
    text: "text-cyan-400",
  },
  emerald: {
    badge: "border-emerald-500/50 bg-emerald-500/5 text-emerald-400",
    border: "hover:border-emerald-500/50",
    text: "text-emerald-400",
  },
  rose: {
    badge: "border-red-500/50 bg-red-500/5 text-red-400",
    border: "hover:border-red-500/50",
    text: "text-red-400",
  },
  purple: {
    badge: "border-purple-500/50 bg-purple-500/5 text-purple-400",
    border: "hover:border-purple-500/50",
    text: "text-purple-400",
  },
};

export default function TermsPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="py-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 border border-cyan-500/50 bg-cyan-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-400">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          GOOD-FAITH PEER LENDING AGREEMENT
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">LEGAL // TERMS</p>
        <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">
          Terms of Service
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400 sm:text-base leading-relaxed">
          Short, readable, and honest. Five sections that define how this collective operates and
          what we expect from every member.
        </p>
      </section>

      {/* Sections */}
      <div className="space-y-5">
        {sections.map((section) => {
          const Icon = section.icon;
          const colors = colorMap[section.color];
          return (
            <section
              key={section.title}
              className={`bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 sm:p-8 transition-colors ${colors.border}`}
            >
              <h2 className={`mb-4 flex items-center gap-3 text-lg font-bold text-white tracking-tight`}>
                <Icon className={`h-5 w-5 ${colors.text}`} aria-hidden="true" />
                {section.title}
              </h2>
              <p className="text-sm leading-relaxed text-zinc-400">{section.body}</p>
            </section>
          );
        })}
      </div>

      <p className="text-center font-mono text-xs text-zinc-500">
        By using this service you also agree to the{" "}
        <Link href="/code-of-conduct" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4">
          Code of Conduct
        </Link>{" "}
        and the{" "}
        <Link href="/privacy" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}

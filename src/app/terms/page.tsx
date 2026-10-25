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
    badge: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    border: "hover:border-cyan-500/40",
    text: "text-cyan-300",
  },
  emerald: {
    badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    border: "hover:border-emerald-500/40",
    text: "text-emerald-300",
  },
  rose: {
    badge: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    border: "hover:border-rose-500/40",
    text: "text-rose-300",
  },
  purple: {
    badge: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    border: "hover:border-purple-500/40",
    text: "text-purple-300",
  },
};

export default function TermsPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center py-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-xs font-semibold mb-6">
          <FileText className="w-4 h-4" aria-hidden="true" />
          GOOD-FAITH PEER LENDING AGREEMENT
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent">
          Terms of Service
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-slate-400 text-sm sm:text-base leading-relaxed">
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
              className={`bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl transition-all duration-300 hover:-translate-y-1 ${colors.border} hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.15)]`}
            >
              <h2 className={`text-xl font-bold flex items-center gap-3 mb-4 ${colors.text}`}>
                <Icon className="w-6 h-6" aria-hidden="true" />
                {section.title}
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">{section.body}</p>
            </section>
          );
        })}
      </div>

      <p className="text-center text-sm text-slate-500">
        By using this service you also agree to the{" "}
        <Link href="/code-of-conduct" className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4">
          Code of Conduct
        </Link>{" "}
        and the{" "}
        <Link href="/privacy" className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}

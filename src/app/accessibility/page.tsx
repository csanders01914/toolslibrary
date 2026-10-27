import Link from "next/link";
import {
  Accessibility,
  BadgeCheck,
  ListChecks,
  Sparkles,
  AlertTriangle,
  MessageCircle,
} from "lucide-react";

export const metadata = {
  title: "Accessibility Statement — Tool Library",
  description: "WCAG 2.2 Level AAA conformance statement and accessibility features.",
};

const implementedFeatures = [
  {
    title: "Skip Link (WCAG 2.4.1)",
    body: "A bypass block is the first focusable element on every page, letting keyboard and screen-reader users jump straight past the navigation to the main content.",
  },
  {
    title: "Keyboard Shortcuts (WCAG 2.1.1)",
    body: "All functionality is operable from a keyboard. Alt+A opens the accessibility menu, Alt+M moves focus to the main content, and Escape closes the menu and returns focus to its trigger.",
  },
  {
    title: "High-Contrast Mode (WCAG 1.4.6 AAA)",
    body: "An optional contrast mode renders pure black backgrounds with white text and yellow highlights, meeting the enhanced 7:1 contrast requirement for all text.",
  },
  {
    title: "Text Spacing Toggle (WCAG 1.4.12)",
    body: "A one-click control increases line height, letter spacing, and word spacing site-wide so no content or functionality is lost when text is re-spaced.",
  },
  {
    title: "Dyslexia-Friendly Font Stack",
    body: "A locally bundled OpenDyslexic font stack can be enabled globally, giving readers with dyslexia a letterform design that reduces mirroring and crowding confusion.",
  },
  {
    title: "Font Scaling to 150% (WCAG 1.4.4)",
    body: "Text can be scaled to 125% and 150% from the accessibility menu without loss of content or functionality; layouts reflow rather than clip or overlap.",
  },
  {
    title: "Enhanced Focus Indicators (WCAG 2.4.11 / 2.4.13)",
    body: "Keyboard focus is always visible, and the enhanced mode draws a bold yellow outline with a black halo that exceeds the focus-appearance minimums in WCAG 2.2.",
  },
  {
    title: "Focus Never Obscured (WCAG 2.4.11)",
    body: "Scroll padding is reserved above every focused target so the sticky navbar can never cover the element receiving keyboard focus during tabbing or fragment navigation.",
  },
  {
    title: "44px Minimum Targets (WCAG 2.5.8 AAA)",
    body: "Every control inside the accessibility menu — radios, switches, and buttons — meets the 44 by 44 CSS pixel target-size practice, well beyond the 24px minimum.",
  },
  {
    title: "Reduced Motion (WCAG 2.3.3 AAA)",
    body: "Animations and transitions can be disabled from the menu, and the site independently honors the operating-system prefers-reduced-motion setting.",
  },
  {
    title: "Reading Guide",
    body: "An optional horizontal bar follows the pointer down the page, helping readers with tracking difficulties keep their place across long lines of text.",
  },
  {
    title: "Large High-Contrast Cursor",
    body: "An enlarged yellow pointer with a black outline can be enabled for low-vision users who struggle to locate the default cursor against dark backgrounds.",
  },
  {
    title: "Live-Region Announcements (WCAG 4.1.3)",
    body: "Every accessibility settings change is announced through a polite screen-reader live region, so status messages reach assistive technology without moving focus.",
  },
  {
    title: "Consistent Help Link (WCAG 3.2.6)",
    body: "The Request Help link appears in the footer at the same relative position on every page, so help is always findable in the same place.",
  },
  {
    title: "No Drag-Only Interactions (WCAG 2.5.7)",
    body: "Nothing on this site requires dragging. All actions can be completed with single taps, clicks, or key presses — no multipoint or path-based gestures.",
  },
  {
    title: "Accessible Authentication (WCAG 3.3.8 / 3.3.9)",
    body: "Signing in requires no cognitive function tests: there are no puzzles, memorization tasks, or transcription challenges, and single-use recovery codes offer an object-free backup path.",
  },
  {
    title: "Underline Links Toggle (WCAG 1.4.1)",
    body: "Links can be force-underlined site-wide so that color is never the only visual means of identifying a link.",
  },
];

const wcag3Adoptions = [
  {
    title: "Focus Appearance Beyond Minimums",
    body: "Focus indicators are larger, thicker, and higher-contrast than the WCAG 2.2 minimum, moving toward the stronger focus-appearance guidance drafted for WCAG 3.0.",
  },
  {
    title: "Operating-System Preference Respect",
    body: "The site honors prefers-reduced-motion, prefers-contrast, and forced-colors directly from your operating system, even before you touch any in-app toggle.",
  },
  {
    title: "Personalization via User Preferences",
    body: "Contrast, font size, spacing, motion, cursor, and link styling are user-controlled preferences persisted anonymously in a cookie and synced to your account — the personalization model WCAG 3.0 is drafting around.",
  },
  {
    title: "Plain-Language Structure",
    body: "Pages are organized under descriptive headings with consistent navigation and short, direct sentences, following the plain-language drafting direction of WCAG 3.0.",
  },
  {
    title: "Outcome-Based Scoring Commitment",
    body: "As the WCAG 3.0 outcome-based scoring model stabilizes toward W3C Recommendation, we commit to adopting it for future conformance assessments of this site.",
  },
];

const knownLimitations = [
  "Full AAA contrast across every gradient headline is not yet universal; a small number of decorative gradient treatments still fall between the AA and AAA contrast thresholds.",
  "The third-party Project Wiki (wiki.tools-library.com) and the Matrix chat interface are separate self-hosted services outside this application's codebase, and their conformance is not covered by this statement.",
  "Automated testing supplements but does not replace manual audit; automated tools catch only a subset of WCAG success criteria, and this statement reflects a self-assessment rather than an independent certification.",
];

export default function AccessibilityStatementPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="py-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 border border-cyan-500/50 bg-cyan-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-400">
          <Accessibility className="h-3.5 w-3.5" aria-hidden="true" />
          WCAG 2.2 LEVEL AAA TARGET
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">LEGAL // ACCESSIBILITY</p>
        <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">
          Accessibility Statement
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400 sm:text-base leading-relaxed">
          Accessibility on this site is an engineering requirement, not an afterthought. Every
          control, label, and layout decision in the design system is built against the Web
          Content Accessibility Guidelines, and the tools to adjust the experience are placed
          directly in your hands.
        </p>
        <img
          src="/wcag2.2-aaa.png"
          alt="W3C WCAG 2.2 Level AAA conformance badge"
          width={220}
          height={78}
          className="mx-auto mt-8"
        />
      </section>

      {/* Conformance statement */}
      <section className="border border-emerald-500/50 bg-[#0a0a0a] rounded-none p-6 sm:p-8">
        <h2 className="mb-6 flex items-center gap-3 text-xl font-bold text-white tracking-tight">
          <BadgeCheck className="h-5 w-5 text-emerald-400" aria-hidden="true" />
          Conformance Statement
        </h2>
        <div className="space-y-4 text-sm leading-relaxed text-zinc-400">
          <p>
            This site targets <strong className="text-white">Web Content Accessibility Guidelines (WCAG) 2.2 Level AAA</strong>,
            with WCAG 2.2 Level AA treated as the non-negotiable hard floor beneath every
            decision. Where a Level AAA criterion is achievable within a terminal-style dark
            interface, we implement it; where it conflicts with a genuine design constraint, we
            document the gap honestly in the limitations below rather than claiming conformance
            we cannot demonstrate.
          </p>
          <p>
            The site was self-assessed against WCAG 2.2 in <strong className="text-white">October 2026</strong> and is
            fully self-hosted: the conformance of every page you load is determined entirely by
            the code in this repository, with no third-party scripts, overlays, or widgets that
            could silently regress it. This is a self-declared conformance claim made by the
            Tool Library Collective under the W3C conformance reporting model.
          </p>
        </div>
      </section>

      {/* Implemented features */}
      <section>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">ACCESSIBILITY // FEATURE INVENTORY</p>
        <h2 className="mb-6 mt-2 flex items-center gap-3 text-2xl font-bold text-white tracking-tight">
          <ListChecks className="h-5 w-5 text-cyan-400" aria-hidden="true" />
          Implemented Accessibility Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {implementedFeatures.map((feature) => (
            <div
              key={feature.title}
              className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 transition-colors hover:border-zinc-600"
            >
              <h3 className="mb-2 font-mono text-xs uppercase tracking-widest text-cyan-400">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WCAG 3.0 draft adoptions */}
      <section className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 sm:p-8">
        <h2 className="mb-6 flex items-center gap-3 text-xl font-bold text-white tracking-tight">
          <Sparkles className="h-5 w-5 text-purple-400" aria-hidden="true" />
          WCAG 3.0 (Draft) Adoptions
        </h2>
        <div className="space-y-4 text-sm leading-relaxed text-zinc-400">
          <p>
            WCAG 3.0 is currently a <strong className="text-white">W3C Working Draft</strong>: it is published for
            review and is explicitly not yet a W3C Standard, and its requirements may change
            before it reaches Recommendation status. We track the draft because its direction —
            outcome-based scoring, broader personalization, and grading usability research
            rather than pass/fail checkpoints — is where web accessibility is heading. Rather
            than wait for the final publication date, we have adopted the draft practices that
            are already implementable today:
          </p>
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          {wcag3Adoptions.map((item) => (
            <div
              key={item.title}
              className="border border-purple-500/30 bg-black rounded-none p-6"
            >
              <h3 className="mb-2 font-mono text-xs uppercase tracking-widest text-purple-400">{item.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Known limitations */}
      <section className="border border-red-500/50 bg-[#0a0a0a] rounded-none p-6 sm:p-8">
        <h2 className="mb-6 flex items-center gap-3 text-xl font-bold text-white tracking-tight">
          <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
          Known Limitations
        </h2>
        <ul className="space-y-3">
          {knownLimitations.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-zinc-400">
              <span className="mt-1.5 h-2 w-2 shrink-0 bg-red-400" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Feedback */}
      <section className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 sm:p-8">
        <h2 className="mb-6 flex items-center gap-3 text-xl font-bold text-white tracking-tight">
          <MessageCircle className="h-5 w-5 text-cyan-400" aria-hidden="true" />
          Feedback & Contact
        </h2>
        <div className="space-y-4 text-sm leading-relaxed text-zinc-400">
          <p>
            If any part of this site is difficult or impossible for you to use, we want to hear
            about it — barriers reported by real users are the fastest route to a fix. Use the{" "}
            <Link href="/help" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4">
              Request Help
            </Link>{" "}
            link in the footer of every page, or reach the collective in the{" "}
            <a
              href="http://matrix.tools-library.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4"
            >
              Matrix Chat
            </a>
            . Both channels are zero-PII by design: we collect no email address, no phone
            number, and no name, so reporting a barrier never requires surrendering personal
            data.
          </p>
          <p>
            We aim to acknowledge accessibility feedback within five business days and to ship a
            remediation or a documented workaround for confirmed barriers as a priority change.
          </p>
        </div>
      </section>

      <p className="text-center font-mono text-xs text-zinc-500">
        This statement concerns this application only. See the{" "}
        <Link href="/privacy" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4">
          Privacy Policy
        </Link>{" "}
        for how the anonymous accessibility preferences are stored.
      </p>
    </div>
  );
}

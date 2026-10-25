/**
 * Random Forest triage classifier for incoming help requests.
 *
 * A lightweight, dependency-free implementation: five independent decision
 * trees, each a deterministic heuristic path over extracted features, vote
 * on the routing decision. Majority weighted vote wins; ties fail safe to
 * HUMAN_ADMIN. Confidence is the winning route's share of total vote weight.
 *
 * Routes:
 *   LLM_AGENT   — automated resolution by the operations agent (safe tools only)
 *   HUMAN_ADMIN — human intervention queue
 */

export type TriageRoute = "LLM_AGENT" | "HUMAN_ADMIN";
export type Urgency = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const HELP_CATEGORIES = [
  "TOOL_ISSUE",
  "SKILL_ISSUE",
  "LOAN_DISPUTE",
  "ACCOUNT_ACCESS",
  "SAFETY_INCIDENT",
  "BUG_REPORT",
  "GENERAL",
] as const;
export type HelpCategory = (typeof HELP_CATEGORIES)[number];

export type TriageFeatures = {
  category: HelpCategory;
  wordCount: number;
  hasUserId: boolean;
  urgency: Urgency;
  scores: {
    safety: number;
    dispute: number;
    account: number;
    bug: number;
    howto: number;
  };
};

export type TriageVerdict = {
  route: TriageRoute;
  confidence: number;
  urgency: Urgency;
  reason: string;
  votes: { LLM_AGENT: number; HUMAN_ADMIN: number };
  treeDecisions: Array<{ tree: string; route: TriageRoute; weight: number }>;
};

// ----------------------------------------------------------------
// Feature extraction
// ----------------------------------------------------------------

const LEXICON: Record<keyof TriageFeatures["scores"], string[]> = {
  safety: [
    "injured", "injury", "injuries", "hurt", "bleeding", "blood", "danger",
    "unsafe", "hazard", "electrocuted", "electrocution", "caught fire",
    "exploded", "shattered", "threat", "weapon", "assault", "hit me", "fell on",
  ],
  dispute: [
    "dispute", "conflict", "argument", "scam", "scammed", "stole", "stolen",
    "harass", "harassment", "harassing", "threaten", "threatening",
    "won't return", "wont return", "not returned", "refuses to return",
    "refuse to return", "damaged it", "broke it and", "blame", "lying",
    "unfair", "abuse", "abusive",
  ],
  account: [
    "login", "log in", "log-in", "password", "locked out", "locked",
    "recover", "recovery code", "recovery codes", "can't log", "cant log",
    "cannot log", "account", "alias", "register", "registration", "sign in",
    "signin", "username",
  ],
  bug: [
    "bug", "bugs", "error", "errors", "crash", "crashes", "crashed", "500",
    "404", "broken page", "not loading", "doesn't load", "doesnt load",
    "upload fails", "can't upload", "cant upload", "site broken",
    "button does nothing", "white screen", "stuck", "typo", "spelling",
  ],
  howto: [
    "how do i", "how to", "how can i", "request a tool", "borrow",
    "borrowing", "lend", "lending", "offer a skill", "book", "booking",
    "coordinate", "return process", "where do i", "where can i", "what is",
    "explain", "guide", "instructions",
  ],
};

const CRITICAL_PATTERNS = [
  "emergency", "injured", "bleeding", "danger right now", "immediate danger",
  "call an ambulance", "hospital", "police", "911", "being threatened",
];

const HIGH_URGENCY_PATTERNS = ["urgent", "asap", "immediately", "right away", "deadline", "today"];

/** Compiles a phrase list to word-boundary regexes (prevents substring traps like "borrow" inside "borrower"). */
function compilePatterns(patterns: string[]): RegExp[] {
  return patterns.map(
    (p) => new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
  );
}

const COMPILED_LEXICON = Object.fromEntries(
  Object.entries(LEXICON).map(([key, patterns]) => [key, compilePatterns(patterns)])
) as Record<keyof TriageFeatures["scores"], RegExp[]>;

const COMPILED_CRITICAL = compilePatterns(CRITICAL_PATTERNS);
const COMPILED_HIGH_URGENCY = compilePatterns(HIGH_URGENCY_PATTERNS);

function countMatches(text: string, regexes: RegExp[]): number {
  let count = 0;
  for (const regex of regexes) {
    if (regex.test(text)) count += 1;
  }
  return count;
}

export function extractFeatures(
  category: string,
  message: string,
  hasUserId: boolean
): TriageFeatures {
  const textLower = message.toLowerCase();
  const scores = {
    safety: countMatches(textLower, COMPILED_LEXICON.safety),
    dispute: countMatches(textLower, COMPILED_LEXICON.dispute),
    account: countMatches(textLower, COMPILED_LEXICON.account),
    bug: countMatches(textLower, COMPILED_LEXICON.bug),
    howto: countMatches(textLower, COMPILED_LEXICON.howto),
  };

  let urgency: Urgency = "LOW";
  if (
    countMatches(textLower, COMPILED_CRITICAL) > 0 ||
    scores.safety >= 2 ||
    category === "SAFETY_INCIDENT"
  ) {
    urgency = "CRITICAL";
  } else if (
    (countMatches(textLower, COMPILED_HIGH_URGENCY) > 0 &&
      scores.safety + scores.dispute + scores.bug >= 1) ||
    scores.dispute >= 2 ||
    category === "LOAN_DISPUTE"
  ) {
    urgency = "HIGH";
  } else if (scores.safety + scores.dispute + scores.account + scores.bug + scores.howto >= 1) {
    urgency = "MEDIUM";
  }

  return {
    category: (HELP_CATEGORIES as readonly string[]).includes(category)
      ? (category as HelpCategory)
      : "GENERAL",
    wordCount: message.trim().split(/\s+/).length,
    hasUserId,
    urgency,
    scores,
  };
}

// ----------------------------------------------------------------
// The forest: five independent decision trees
// ----------------------------------------------------------------

type TreeResult = { tree: string; route: TriageRoute; weight: number };

type DecisionTree = {
  name: string;
  decide: (f: TriageFeatures, text: string) => TreeResult;
};

const forest: DecisionTree[] = [
  {
    // Tree 1 — safety first: anything touching physical harm goes to humans.
    name: "SAFETY_FIRST",
    decide: (f) => {
      if (f.scores.safety >= 2 || f.urgency === "CRITICAL") {
        return { tree: "SAFETY_FIRST", route: "HUMAN_ADMIN", weight: 1.0 };
      }
      if (f.scores.safety === 1) {
        return { tree: "SAFETY_FIRST", route: "HUMAN_ADMIN", weight: 0.8 };
      }
      return { tree: "SAFETY_FIRST", route: "LLM_AGENT", weight: 0.6 };
    },
  },
  {
    // Tree 2 — interpersonal disputes and trust violations need human judgment.
    name: "INTERPERSONAL",
    decide: (f, text) => {
      if (
        f.scores.dispute >= 2 ||
        /harass|threaten|scam|stole|stolen/.test(text)
      ) {
        return { tree: "INTERPERSONAL", route: "HUMAN_ADMIN", weight: 0.9 };
      }
      if (f.scores.dispute === 1) {
        return { tree: "INTERPERSONAL", route: "HUMAN_ADMIN", weight: 0.6 };
      }
      return { tree: "INTERPERSONAL", route: "LLM_AGENT", weight: 0.6 };
    },
  },
  {
    // Tree 3 — account/access issues: agent can explain, humans handle locks.
    name: "ACCOUNT_TRUST",
    decide: (f) => {
      if (f.scores.account >= 1 && (f.urgency === "HIGH" || f.urgency === "CRITICAL")) {
        return { tree: "ACCOUNT_TRUST", route: "HUMAN_ADMIN", weight: 0.7 };
      }
      if (f.scores.account >= 1) {
        return { tree: "ACCOUNT_TRUST", route: "LLM_AGENT", weight: 0.7 };
      }
      return { tree: "ACCOUNT_TRUST", route: "LLM_AGENT", weight: 0.5 };
    },
  },
  {
    // Tree 4 — self-service: bugs and how-to questions are agent territory,
    // but defer to the specialist trees when dispute/safety signals exist.
    name: "SELF_SERVICE",
    decide: (f, text) => {
      if (f.scores.dispute >= 1 || f.scores.safety >= 1) {
        return { tree: "SELF_SERVICE", route: "HUMAN_ADMIN", weight: 0.5 };
      }
      if (f.scores.bug >= 1) {
        if (/data loss|deleted everything|lost all/.test(text)) {
          return { tree: "SELF_SERVICE", route: "HUMAN_ADMIN", weight: 0.8 };
        }
        return { tree: "SELF_SERVICE", route: "LLM_AGENT", weight: 0.7 };
      }
      if (f.scores.howto >= 1) {
        return { tree: "SELF_SERVICE", route: "LLM_AGENT", weight: 0.8 };
      }
      return { tree: "SELF_SERVICE", route: "LLM_AGENT", weight: 0.4 };
    },
  },
  {
    // Tree 5 — urgency escalation: high heat goes to humans regardless of topic.
    name: "URGENCY_ESCALATION",
    decide: (f) => {
      if (f.urgency === "CRITICAL") {
        return { tree: "URGENCY_ESCALATION", route: "HUMAN_ADMIN", weight: 1.0 };
      }
      if (f.urgency === "HIGH") {
        return { tree: "URGENCY_ESCALATION", route: "HUMAN_ADMIN", weight: 0.6 };
      }
      if (f.urgency === "MEDIUM") {
        return { tree: "URGENCY_ESCALATION", route: "LLM_AGENT", weight: 0.6 };
      }
      return { tree: "URGENCY_ESCALATION", route: "LLM_AGENT", weight: 0.7 };
    },
  },
];

// ----------------------------------------------------------------
// Forest vote
// ----------------------------------------------------------------

export function triageHelpRequest(
  category: string,
  message: string,
  hasUserId: boolean
): TriageVerdict {
  const features = extractFeatures(category, message, hasUserId);
  const text = message.toLowerCase();

  const treeDecisions = forest.map((tree) => tree.decide(features, text));

  let llmWeight = 0;
  let humanWeight = 0;
  for (const decision of treeDecisions) {
    if (decision.route === "LLM_AGENT") llmWeight += decision.weight;
    else humanWeight += decision.weight;
  }

  // Fail-safe: ties and near-ties go to humans.
  const route: TriageRoute =
    humanWeight > llmWeight || Math.abs(humanWeight - llmWeight) < 0.1
      ? "HUMAN_ADMIN"
      : "LLM_AGENT";

  const total = llmWeight + humanWeight;
  const confidence = total > 0 ? Math.max(llmWeight, humanWeight) / total : 0;

  const dominant = treeDecisions
    .filter((d) => d.route === route)
    .sort((a, b) => b.weight - a.weight)[0];

  const featureSummary = Object.entries(features.scores)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}:${v}`)
    .join(" ");

  const reason = [
    `Forest vote ${treeDecisions.filter((d) => d.route === "HUMAN_ADMIN").length}/5 trees → ${route}`,
    dominant ? `decisive tree ${dominant.tree}` : "",
    `urgency ${features.urgency}`,
    featureSummary ? `signals [${featureSummary}]` : "no strong signals",
  ]
    .filter(Boolean)
    .join("; ");

  return {
    route,
    confidence: Math.round(confidence * 100) / 100,
    urgency: features.urgency,
    reason,
    votes: { LLM_AGENT: llmWeight, HUMAN_ADMIN: humanWeight },
    treeDecisions,
  };
}

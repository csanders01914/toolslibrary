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

import type { BotResponseKey } from "@/lib/botResponses";

/**
 * Deterministic intent router.
 *
 * Pure regular expressions over the lowercased user input, evaluated in
 * strict priority order — the first matching rule wins. No external
 * services, no statistical classifiers, no third-party libraries.
 *
 * Rules are ordered so that high-severity reports (moderation, missing or
 * damaged equipment) are classified before generic how-to questions that
 * may share keywords.
 */

export type HelpIntent = BotResponseKey;

const INTENT_RULES: ReadonlyArray<{ intent: HelpIntent; pattern: RegExp }> = [
  {
    intent: "report_moderation",
    pattern: /(harass|threat|creepy|scam|abuse|inappropriate|rude|block user|report user|spam)/,
  },
  {
    intent: "missing_tool",
    pattern: /(stole|stolen|never returned|won't return|kept my|missing tool|ghosted with)/,
  },
  {
    intent: "damaged_tool",
    pattern: /(?=.*(broke|broken|damaged|not working|won't start|smoked|snapped))(?=.*(tool|drill|saw|mower|item|equipment|it))/,
  },
  {
    intent: "password_reset",
    pattern: /(?=.*(forgot|lost|locked|reset|recover|can't))(?=.*(password|account|login|seed|sign in))/,
  },
  {
    intent: "account_deletion",
    pattern: /(?=.*(delete|remove|wipe|close|erase))(?=.*(account|profile|data|alias))/,
  },
  {
    intent: "change_alias",
    pattern: /(?=.*(change|update|edit|rename))(?=.*(alias|username|name|handle))/,
  },
  {
    intent: "privacy_info",
    pattern: /(zero-pii|pii|privacy|personal data|trackers|telemetry|anonymous|why no email|phone number)/,
  },
  {
    intent: "guest_limits",
    pattern: /(?=.*(guest|without an account|not logged in))(?=.*(borrow|message|list|post|chat|why can't i))/,
  },
  {
    intent: "qr_code_help",
    pattern: /(qr|barcode|scan|label|tag)/,
  },
  {
    intent: "skills_exchange",
    pattern: /(skill|teach|learn|help me fix|mentor|knowledge|advice)/,
  },
  {
    intent: "matrix_chat_info",
    pattern: /(matrix|element|synapse|community chat|general chat|chat server)/,
  },
  {
    intent: "wiki_docs",
    pattern: /(wiki|leafwiki|documentation|docs|manual|user guide|faq|how does this work)/,
  },
  {
    intent: "manage_listing",
    pattern: /(?=.*(how to|add|create|post|pause|hide|vacation|unlist|edit))(?=.*(listing|tool|inventory|item))/,
  },
  {
    intent: "borrow_limit",
    pattern: /(?=.*(how many|limit|max|maximum))(?=.*(borrow|tools|items|loans))/,
  },
  {
    intent: "late_extension",
    pattern: /(?=.*(late|extend|extension|longer|keep it|extra day|overdue))(?=.*(return|tool|loan|borrow))/,
  },
  {
    intent: "unresponsive_user",
    pattern: /(not replying|not responding|no response|ignoring|hasn't answered|inactive)/,
  },
  {
    intent: "consumables_policy",
    pattern: /(sandpaper|blade|drill bit|fuel|gas|gasoline|oil|consumable|battery|charge)/,
  },
  {
    intent: "cost_and_fees",
    pattern: /(how much|cost|fee|money|pay|deposit|free|charge|price|rent)/,
  },
  {
    intent: "handoff_rules",
    pattern: /(?=.*(where|how|arrange|coordinate))(?=.*(pick up|pickup|get|meet|handoff|drop off|porch))/,
  },
  {
    intent: "prohibited_items",
    pattern: /(allowed to list|prohibited|banned|weapons|gun|firearm|car|vehicle|chemical)/,
  },
  {
    intent: "safety_guidelines",
    pattern: /(safe to meet|stranger|sketchy|safety|contactless|public place)/,
  },
  {
    intent: "tool_safety",
    pattern: /(how to use|hurt|injury|dangerous|ppe|goggles|safety glasses|instructions)/,
  },
  {
    intent: "financial_support",
    pattern: /(liberapay|donate money|support the site|server cost|patreon|paypal|chip in|crowdfund)/,
  },
  {
    intent: "donate_tool",
    pattern: /(?=.*(donate|give|gift))(?=.*(tool|equipment|item|mower|drill))/,
  },
  {
    intent: "open_source_code",
    pattern: /(github|open source|source code|repo|repository|agpl|pull request|found a bug|codebase)/,
  },
];

/**
 * Routes a normalized help message to an intent key.
 * Input is lowercased once; the first matching rule in priority order wins.
 * Falls back to "default_fallback" when no rule matches.
 */
export function routeHelpRequest(userInput: string): HelpIntent {
  const normalized = userInput.toLowerCase();

  for (const rule of INTENT_RULES) {
    if (rule.pattern.test(normalized)) {
      return rule.intent;
    }
  }

  return "default_fallback";
}

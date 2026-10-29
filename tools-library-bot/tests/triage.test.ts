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

import { test } from "node:test";
import assert from "node:assert/strict";
import { routeHelpRequest } from "../src/triage/intentRouter";
import { evaluateMessage } from "../src/triage/triageEngine";
import { botResponses } from "../src/triage/responses";

/**
 * Deterministic triage suite.
 *
 * Covers: every intent rule, priority ordering between overlapping rules,
 * the escalation/auto-resolve logic gates, and the response dictionary's
 * integrity (26 fixed strings, tone-policy compliant).
 */

const ROUTING_CASES: ReadonlyArray<[input: string, expected: string]> = [
  // Rule 1 — report_moderation
  ["someone is harassing me", "report_moderation"],
  ["this user sent me inappropriate messages", "report_moderation"],
  ["total scam alert", "report_moderation"],
  // Rule 2 — missing_tool
  ["he stole my mower", "missing_tool"],
  ["my tool was never returned", "missing_tool"],
  // Rule 3 — damaged_tool
  ["my drill broke", "damaged_tool"],
  ["the mower is not working anymore", "damaged_tool"],
  // Rule 4 — password_reset
  ["i forgot my password", "password_reset"],
  ["how do i reset my password", "password_reset"],
  ["i am locked out of my account", "password_reset"],
  // Rule 5 — account_deletion
  ["delete my account", "account_deletion"],
  ["wipe all my data", "account_deletion"],
  // Rule 6 — change_alias
  ["i want to change my alias", "change_alias"],
  ["rename my username please", "change_alias"],
  // Rule 7 — privacy_info
  ["explain your privacy policy", "privacy_info"],
  ["why no email required", "privacy_info"],
  // Rule 8 — guest_limits
  ["can a guest borrow a tool", "guest_limits"],
  ["as a guest why can't i borrow", "guest_limits"],
  // Rule 9 — qr_code_help
  ["how do i scan the qr label", "qr_code_help"],
  ["my barcode will not scan", "qr_code_help"],
  // Rule 10 — skills_exchange
  ["i want to learn welding", "skills_exchange"],
  ["can someone teach me sewing", "skills_exchange"],
  // Rule 11 — matrix_chat_info
  ["is there a matrix chat", "matrix_chat_info"],
  ["how do i join the community chat", "matrix_chat_info"],
  // Rule 12 — wiki_docs
  ["where is the wiki", "wiki_docs"],
  ["is there a user guide", "wiki_docs"],
  // Rule 13 — manage_listing
  ["how to add a listing", "manage_listing"],
  ["i need to pause my tool while on vacation", "manage_listing"],
  // Rule 14 — borrow_limit
  ["how many tools can i borrow", "borrow_limit"],
  ["what is the maximum number of loans", "borrow_limit"],
  // Rule 15 — late_extension
  ["i will be late returning the tool", "late_extension"],
  ["can i get an extension on my loan", "late_extension"],
  // Rule 16 — unresponsive_user
  ["the owner is not responding", "unresponsive_user"],
  ["my borrower is ignoring me", "unresponsive_user"],
  // Rule 17 — consumables_policy
  ["does the drill need fuel", "consumables_policy"],
  ["who supplies the sandpaper", "consumables_policy"],
  // Rule 18 — cost_and_fees
  ["how much does it cost", "cost_and_fees"],
  ["are there any fees", "cost_and_fees"],
  // Rule 19 — handoff_rules
  ["where do we meet for pickup", "handoff_rules"],
  ["how do we arrange the handoff", "handoff_rules"],
  // Rule 20 — prohibited_items
  ["are guns allowed to list", "prohibited_items"],
  ["are vehicles prohibited", "prohibited_items"],
  // Rule 21 — safety_guidelines
  ["is it safe to meet a stranger", "safety_guidelines"],
  ["should i do contactless pickup", "safety_guidelines"],
  // Rule 22 — tool_safety
  ["how to use a circular saw", "tool_safety"],
  ["do i need ppe and goggles", "tool_safety"],
  // Rule 23 — financial_support
  ["i would like to chip in", "financial_support"],
  ["how do i support the site", "financial_support"],
  // Rule 24 — donate_tool
  ["i want to donate my old mower", "donate_tool"],
  ["can i gift equipment", "donate_tool"],
  // Rule 25 — open_source_code
  ["where is the source code", "open_source_code"],
  ["is this under the agpl", "open_source_code"],
  // Fallback
  ["hello there", "default_fallback"],
  ["asdfgh qwerty", "default_fallback"],
  // Priority ordering proofs — earlier rules win over later overlapping ones.
  ["someone stole my tool and i want to report this abuse", "report_moderation"],
  ["my drill broke and i feel it was stolen", "missing_tool"],
  // Documented consequence of the specified priority order: "can't" + "account"
  // satisfies rule 4 (password_reset) before rule 8 (guest_limits) is reached.
  ["why can't i post without an account", "password_reset"],
];

test("intent router: every rule routes its phrasings to the right intent", () => {
  for (const [input, expected] of ROUTING_CASES) {
    assert.equal(
      routeHelpRequest(input),
      expected,
      `"${input}" should route to ${expected}`
    );
  }
});

test("intent router: input is matched case-insensitively", () => {
  assert.equal(routeHelpRequest("I FORGOT MY PASSWORD"), "password_reset");
  assert.equal(routeHelpRequest("My Drill BROKE"), "damaged_tool");
});

test("response dictionary: exactly 26 fixed, non-empty strings", () => {
  const keys = Object.keys(botResponses);
  assert.equal(keys.length, 26);
  for (const [key, text] of Object.entries(botResponses)) {
    assert.equal(typeof text, "string", `response "${key}" must be a string`);
    assert.ok(text.length > 20, `response "${key}" must be substantive`);
  }
});

test("response dictionary: tone policy — no forbidden persona words", () => {
  const forbidden = /\b(human|ai|llm|agent|provider)\b/i;
  for (const [key, text] of Object.entries(botResponses)) {
    assert.ok(
      !forbidden.test(text),
      `response "${key}" must not contain a forbidden persona term`
    );
  }
});

test("triage engine: keyword matches auto-resolve with the scripted reply", () => {
  const result = evaluateMessage("i forgot my password");
  assert.equal(result.intent, "password_reset");
  assert.equal(result.autoResolved, true);
  assert.equal(result.escalated, false);
  assert.equal(result.replyText, botResponses.password_reset);
});

test("triage engine: safety-critical matches escalate to the admin team", () => {
  for (const input of ["someone is harassing me", "he stole my mower", "my drill broke"]) {
    const result = evaluateMessage(input);
    assert.equal(result.autoResolved, false, `"${input}" must not auto-resolve`);
    assert.equal(result.escalated, true, `"${input}" must escalate`);
    assert.equal(result.replyText, botResponses[result.intent]);
  }
});

test("triage engine: unmatched messages fall back and escalate", () => {
  const result = evaluateMessage("purple elephant unicorns");
  assert.equal(result.intent, "default_fallback");
  assert.equal(result.autoResolved, false);
  assert.equal(result.escalated, true);
  assert.equal(result.replyText, botResponses.default_fallback);
});

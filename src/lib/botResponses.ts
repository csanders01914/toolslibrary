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

/**
 * Pre-written support responses.
 *
 * Every automated reply is a fixed, reviewed string — nothing is generated
 * at runtime. The intent router (src/lib/intentRouter.ts) selects the key;
 * the triage engine (src/lib/triageEngine.ts) delivers the text.
 */

export const botResponses = {
  password_reset:
    "It looks like you need help with your login. Because we use a zero-PII system, you will need your original recovery seed to reset your password. You can use it here: https://tools-library.com/recover",

  account_deletion:
    "Because we collect absolutely zero personal data, deleting your account is instant and irreversible. You can permanently wipe your alias and data from the settings page: https://tools-library.com/settings/danger",

  change_alias:
    "Your username is permanent for login purposes, but you can update your public display alias at any time from your account settings page.",

  privacy_info:
    "We operate on a strict zero-PII (Personally Identifiable Information) architecture. We never ask for your real name, email, or phone number, and we run zero telemetry or third-party trackers.",

  guest_limits:
    "Guest browsing lets you search our entire local inventory of tools and skills without an account. To message a neighbor, borrow equipment, or list your own items, you'll need to register with a username, alias, and password.",

  borrow_limit:
    "Our system currently limits users to borrowing 3 tools at a time to ensure equipment stays available for the whole neighborhood. You can return an active item to free up a slot!",

  handoff_rules:
    "Tool handoffs are coordinated directly between neighbors! Once a borrow request is accepted, use the built-in messenger to agree on a public meeting spot or a porch-pickup time that works for both of you.",

  late_extension:
    "Running behind on a project? No problem! Please message the tool's owner directly in your loan chat as soon as possible to ask for a time extension so they know when to expect it back.",

  unresponsive_user:
    "If a neighbor isn't responding to your borrow request or handoff messages after 48 hours, feel free to cancel the request and reach out to another lender, or flag the listing if you think the account is inactive.",

  missing_tool:
    "If a borrower is overdue and unresponsive regarding your equipment, I have flagged this conversation for the admin team. Someone will step in shortly to help resolve the situation and review the borrower's account.",

  damaged_tool:
    "I understand a tool might be broken. Don't worry, wear and tear happens! I've flagged this for the admin team. Please hold onto the tool for now, and someone will reach out shortly to figure out the next steps.",

  consumables_policy:
    "Unless a lender specifies otherwise, borrowers are generally expected to supply their own consumables (like sandpaper, saw blades, drill bits, or 2-stroke fuel) and return gas-powered equipment with the same fuel level it had at pickup.",

  cost_and_fees:
    "The Tools-Library is a 100% free mutual aid platform. There are no rental fees, subscription costs, or late fees—just neighbors helping neighbors.",

  qr_code_help:
    "Our QR code system helps you track and check in physical tools! You can generate and print a QR label from your tool's listing page, stick it on the tool case, and scan it during handoffs to instantly update the loan status.",

  skills_exchange:
    "You don't need physical tools to participate! Our Skills Exchange module lets you offer or request practical knowledge—like basic carpentry, appliance repair, gardening advice, or sewing. You can browse or post skills right from the main dashboard.",

  manage_listing:
    "To add a new tool, click 'List a Tool' on your dashboard. Going out of town or using your equipment for a personal project? You can toggle any of your listings to 'Unavailable/Paused' in your inventory settings.",

  matrix_chat_info:
    "In addition to our built-in loan messenger, we host a community Matrix server for general neighborhood chat, project advice, and talking directly with the admin. You can join at https://chat.tools-library.com.",

  wiki_docs:
    "Looking for step-by-step guides on how the platform works? Check out our documentation hub on LeafWiki for full walkthroughs on tool tagging, account security, and community guidelines.",

  safety_guidelines:
    "Your safety comes first. When meeting a neighbor for the first time, we recommend doing handoffs in a well-lit public place or arranging a contactless porch pickup. Never share personal details you aren't comfortable giving out.",

  tool_safety:
    "Always wear appropriate personal protective equipment (PPE) like safety glasses and gloves, and inspect tools before use. If you aren't sure how to operate a piece of equipment safely, ask the owner for a quick rundown or check our Skills Exchange!",

  prohibited_items:
    "To keep the community safe, we do not allow listings for firearms, weapons, hazardous chemicals, motorized road vehicles, or illegal items. Stick to hand tools, power tools, yard equipment, maker gear, and household repair items.",

  report_moderation:
    "We take community trust seriously. I have flagged your message as a moderation priority, and an admin will review this chat shortly to take appropriate action.",

  donate_tool:
    "That's awesome! If you have equipment you'd like to permanently contribute to the community pool, you can list it on the platform and tag it as a 'Permanent Community Tool', or message the admin to arrange a drop-off.",

  financial_support:
    "The platform is completely free to use, but if you'd like to help chip in for our self-hosted server and domain costs, you can support the project on Liberapay! Check our README or footer for the link.",

  open_source_code:
    "The Tools-Library is 100% open-source under the AGPL-3.0 license. If you want to inspect the code, report a technical bug, or submit a pull request, you can find our repository on GitHub at https://github.com/csanders01914.",

  default_fallback:
    "I'm an automated system and didn't quite catch that. I've forwarded your message to the admin team, and someone will reply in this chat shortly.",
} as const;

export type BotResponseKey = keyof typeof botResponses;

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
import { parseCommand, listCommands } from "../src/commands/registry";
import { isAllowedRoom, isHelpDeskRoom, isAdminRoom } from "../src/rooms";
import { config } from "../src/config";

/**
 * Command-module and scope-guard suite.
 */

test("command parser: extracts the name and the argument string", () => {
  assert.deepEqual(parseCommand("!help"), { name: "help", args: "" });
  assert.deepEqual(parseCommand("!tools hand tools"), { name: "tools", args: "hand tools" });
  assert.deepEqual(parseCommand("  !ping  "), { name: "ping", args: "" });
  assert.deepEqual(parseCommand("!support the mower won't start"), {
    name: "support",
    args: "the mower won't start",
  });
});

test("command parser: names are case-insensitive", () => {
  assert.deepEqual(parseCommand("!HELP"), { name: "help", args: "" });
  assert.deepEqual(parseCommand("!Search drill"), { name: "search", args: "drill" });
});

test("command parser: non-commands and bare prefixes return null", () => {
  assert.equal(parseCommand("hello there"), null);
  assert.equal(parseCommand(""), null);
  assert.equal(parseCommand("!"), null);
  assert.equal(parseCommand("!   "), null);
});

test("command registry: every documented command resolves, including aliases", () => {
  const names = listCommands().map((command) => command.name);
  assert.deepEqual(
    [...names].sort(),
    ["help", "ping", "search", "status", "support", "tools"]
  );
  for (const command of listCommands()) {
    assert.equal(typeof command.execute, "function");
    assert.ok(command.usage.startsWith(`!${command.name}`));
  }
  const help = listCommands().find((command) => command.name === "help");
  assert.ok(help);
  assert.deepEqual([...help.aliases], ["faq"]);
});

test("room scope: only the Help Desk and admin rooms are allowed", () => {
  assert.equal(isHelpDeskRoom(config.helpDeskRoomId), true);
  assert.equal(isAdminRoom(config.adminRoomId), true);
  assert.equal(isAllowedRoom(config.helpDeskRoomId), true);
  assert.equal(isAllowedRoom(config.adminRoomId), true);
  assert.equal(isAllowedRoom("!someOtherRoom:example.org"), false);
  assert.equal(isHelpDeskRoom(config.adminRoomId), false);
  assert.equal(isAdminRoom(config.helpDeskRoomId), false);
});

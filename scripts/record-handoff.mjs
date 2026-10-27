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

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const [,, phaseName, nextInstructions = "Proceed to next sequential phase"] = process.argv;
if (!phaseName) {
  console.error("Usage: node scripts/record-handoff.mjs <PHASE_ID> <NEXT_INSTRUCTIONS>");
  process.exit(1);
}

const handoffDir = path.resolve(process.cwd(), '.handoff');
fs.mkdirSync(handoffDir, { recursive: true });

const files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .map(f => f.trim())
  .filter(f => f && !f.startsWith('.handoff/') && !f.startsWith('data/') && fs.existsSync(f) && fs.statSync(f).isFile());

const checksums = {};
for (const file of files) {
  checksums[file] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const payload = {
  last_completed_phase: phaseName,
  timestamp: new Date().toISOString(),
  next_session_instructions: nextInstructions,
  checksums
};

const phaseFile = path.join(handoffDir, `${phaseName.toLowerCase()}.json`);
fs.writeFileSync(phaseFile, JSON.stringify(payload, null, 2));
fs.writeFileSync(path.join(handoffDir, 'CURRENT_STATE.json'), JSON.stringify(payload, null, 2));
console.log(JSON.stringify({ recorded: phaseFile, tracked_file_count: files.length }, null, 2));

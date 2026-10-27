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

const handoffDir = path.resolve(process.cwd(), '.handoff');
const currentStateFile = path.join(handoffDir, 'CURRENT_STATE.json');

if (!fs.existsSync(currentStateFile)) {
  console.log(JSON.stringify({ status: "INIT", last_completed_phase: null, message: "Ready for PHASE_01_FOUNDATION" }, null, 2));
  process.exit(0);
}

const state = JSON.parse(fs.readFileSync(currentStateFile, 'utf8'));
const driftReport = [];

for (const [filePath, expectedHash] of Object.entries(state.checksums || {})) {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    driftReport.push({ file: filePath, error: "File missing" });
    continue;
  }
  const actualHash = crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex');
  if (actualHash !== expectedHash) {
    driftReport.push({ file: filePath, error: "Checksum mismatch", expected: expectedHash, actual: actualHash });
  }
}

if (driftReport.length > 0) {
  console.error(JSON.stringify({ status: "DRIFT_DETECTED", report: driftReport }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ status: "VERIFIED", last_completed_phase: state.last_completed_phase, next: state.next_session_instructions }, null, 2));

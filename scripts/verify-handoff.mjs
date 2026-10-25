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

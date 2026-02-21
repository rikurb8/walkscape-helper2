import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runFishing3055Eval } from "./fishing-30-55.eval.js";
import { runLocalSkillQuestion } from "../index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const FISHING_PARSE_PATH = path.join(PROJECT_ROOT, "data", "raw", "skills", "fishing_parse.json");

test("fishing 30->55 route picks expected activities", async (t) => {
  if (!(await hasFishingData())) {
    t.skip(`requires ${FISHING_PARSE_PATH}`);
    return;
  }

  const response = await runLocalSkillQuestion("what should i do to get fishing from 30 to 55?");
  const segments = response.route.segments;

  assert.equal(segments.length, 3);
  assert.deepEqual(
    segments.map((segment) => ({
      from: segment.fromLevel,
      to: segment.toLevel,
      activity: segment.activityName
    })),
    [
      { from: 30, to: 35, activity: "Sea fishing (Spear)" },
      { from: 35, to: 40, activity: "Sea fishing (Cage)" },
      { from: 40, to: 55, activity: "Magnet fishing" }
    ]
  );
});

test("fishing 30->55 eval passes", async (t) => {
  if (!(await hasFishingData())) {
    t.skip(`requires ${FISHING_PARSE_PATH}`);
    return;
  }

  const result = await runFishing3055Eval();

  assert.equal(result.passed, true);
  assert.equal(result.score, 1);
  assert.equal(result.scorer.name, "keyword-coverage-scorer");
  assert.equal(result.scorer.score >= 0.8, true);
});

async function hasFishingData(): Promise<boolean> {
  try {
    await fs.access(FISHING_PARSE_PATH);
    return true;
  } catch {
    return false;
  }
}

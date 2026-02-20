import assert from "node:assert/strict";
import test from "node:test";

import { runFishing3055Eval } from "./fishing-30-55.eval.js";
import { runLocalSkillQuestion } from "../index.js";

test("fishing 30->55 route picks expected activities", async () => {
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

test("fishing 30->55 eval passes", async () => {
  const result = await runFishing3055Eval();

  assert.equal(result.passed, true);
  assert.equal(result.score, 1);
  assert.equal(result.scorer.name, "keyword-coverage-scorer");
  assert.equal(result.scorer.score >= 0.8, true);
});

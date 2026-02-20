import { pathToFileURL } from "node:url";

import { createKeywordCoverageScorer } from "@mastra/evals/scorers/prebuilt";
import { createAgentTestRun, createTestMessage } from "@mastra/evals/scorers/utils";

import { runLocalSkillQuestion } from "../index.js";

export interface EvalResult {
  passed: boolean;
  score: number;
  details: string[];
  scorer: {
    name: string;
    score: number;
  };
}

const ROUTE_COVERAGE_SCORER = createKeywordCoverageScorer();
const EXPECTED_ROUTE_KEYWORDS =
  "Sea fishing Spear Sea fishing Cage Magnet fishing Casbrant Grave Winter End Old Arena Ruins 30 35 40 55";

export async function runFishing3055Eval(): Promise<EvalResult> {
  const response = await runLocalSkillQuestion("what should i do to get fishing from 30 to 55?");
  const segments = response.route.segments;

  const scorerRun = createAgentTestRun({
    inputMessages: [createTestMessage({ role: "user", content: EXPECTED_ROUTE_KEYWORDS })],
    output: [createTestMessage({ role: "assistant", content: response.answer })]
  });
  const scorerResult = await ROUTE_COVERAGE_SCORER.run(scorerRun);

  const checks: Array<{ ok: boolean; message: string }> = [
    {
      ok:
        segments.length >= 3 &&
        segments[0].fromLevel === 30 &&
        segments[0].toLevel === 35 &&
        segments[0].activityName === "Sea fishing (Spear)",
      message: "30-35 should use Sea fishing (Spear)"
    },
    {
      ok:
        segments.length >= 3 &&
        segments[1].fromLevel === 35 &&
        segments[1].toLevel === 40 &&
        segments[1].activityName === "Sea fishing (Cage)",
      message: "35-40 should use Sea fishing (Cage)"
    },
    {
      ok:
        segments.length >= 3 &&
        segments[2].fromLevel === 40 &&
        segments[2].toLevel === 55 &&
        segments[2].activityName === "Magnet fishing",
      message: "40-55 should use Magnet fishing"
    },
    {
      ok: scorerResult.score >= 0.8,
      message: "@mastra/evals keyword coverage scorer should be >= 0.8"
    }
  ];

  const passedCount = checks.filter((check) => check.ok).length;
  const score = passedCount / checks.length;

  return {
    passed: passedCount === checks.length,
    score,
    details: checks.map((check) => `${check.ok ? "PASS" : "FAIL"}: ${check.message}`),
    scorer: {
      name: "keyword-coverage-scorer",
      score: scorerResult.score
    }
  };
}

async function main(): Promise<void> {
  const result = await runFishing3055Eval();
  console.log(JSON.stringify(result, null, 2));

  if (!result.passed) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}

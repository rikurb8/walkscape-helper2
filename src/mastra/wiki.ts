#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import {
  printAiUsageSummary,
  printCommandError,
  printJson,
  stripBooleanFlag
} from "../cli-output.js";
import { runLocalWikiQuestion } from "./index.js";

export async function runWikiCommandCli(argv: string[]): Promise<void> {
  const parsed = stripBooleanFlag(argv, "--json");
  const rawQuestion = parsed.args.join(" ").trim();
  if (!rawQuestion) {
    throw new Error(
      'Usage: walkscape-helper wiki [--json] "where can i train fishing from level 32 to 50?"'
    );
  }

  const result = await runLocalWikiQuestion(rawQuestion);

  if (parsed.enabled) {
    printJson({
      mode: "wiki",
      ok: true,
      question: rawQuestion,
      answer: result.answer,
      matches: toMatches(result.matches),
      ai: result.ai
    });
    return;
  }

  console.log("=== WalkScape Wiki ===");
  console.log(`Question: ${rawQuestion}`);
  console.log("");
  console.log(result.answer);

  if (result.matches.length) {
    console.log("");
    console.log("Top matches:");
    for (const [index, match] of result.matches.slice(0, 5).entries()) {
      console.log(`${index + 1}. ${match.id} (score ${match.score.toFixed(3)})`);
    }
  }

  console.log("");
  printAiUsageSummary(result.ai);
}

if (isDirectExecution()) {
  const jsonMode = process.argv.includes("--json");

  void runWikiCommandCli(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("wiki", error, jsonMode);
    process.exitCode = 1;
  });
}

function toMatches(matches: Array<{ id: string; score: number }>): Array<{
  id: string;
  score: number;
}> {
  return matches.slice(0, 5).map((match) => ({
    id: match.id,
    score: match.score
  }));
}

function isDirectExecution(): boolean {
  const entryPoint = process.argv[1];
  if (!entryPoint) {
    return false;
  }

  return import.meta.url === pathToFileURL(entryPoint).href;
}

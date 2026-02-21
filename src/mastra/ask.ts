#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import {
  printAiUsageSummary,
  printCommandError,
  printJson,
  stripBooleanFlag
} from "../cli-output.js";
import { runLocalSkillQuestion } from "./index.js";

export async function runAskCommandCli(argv: string[]): Promise<void> {
  const parsed = stripBooleanFlag(argv, "--json");
  const rawQuestion = parsed.args.join(" ").trim();
  if (!rawQuestion) {
    throw new Error('Usage: walkscape-helper ask [--json] "how to get from fishing 35 to 50?"');
  }

  const result = await runLocalSkillQuestion(rawQuestion);

  if (parsed.enabled) {
    printJson({
      mode: "ask",
      ok: true,
      question: rawQuestion,
      answer: result.answer,
      ai: result.ai
    });
    return;
  }

  console.log("=== Skill Route Planner ===");
  console.log(`Question: ${rawQuestion}`);
  console.log("");
  console.log(result.answer);
  console.log("");
  printAiUsageSummary(result.ai);
}

if (isDirectExecution()) {
  const jsonMode = process.argv.includes("--json");

  void runAskCommandCli(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("ask", error, jsonMode);
    process.exitCode = 1;
  });
}

function isDirectExecution(): boolean {
  const entryPoint = process.argv[1];
  if (!entryPoint) {
    return false;
  }

  return import.meta.url === pathToFileURL(entryPoint).href;
}

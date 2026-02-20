import { promises as fs } from "node:fs";

import { printCommandError, printJson, stripBooleanFlag } from "../cli-output.js";
import {
  loadGuideContext,
  parseCharacterExport,
  resetGuideContext,
  saveGuideContext,
  type GuideContext
} from "./guide-context.js";
import { runLocalSkillQuestion, runLocalWikiQuestion } from "./index.js";

const SKILL_NAMES = [
  "agility",
  "carpentry",
  "cooking",
  "crafting",
  "fishing",
  "foraging",
  "mining",
  "smithing",
  "trinketry",
  "woodcutting"
] as const;

type SkillQuestionResult = Awaited<ReturnType<typeof runLocalSkillQuestion>>;
type WikiQuestionResult = Awaited<ReturnType<typeof runLocalWikiQuestion>>;

interface GuideSetResult {
  username: string;
}

interface GuideImportResult {
  context: GuideContext;
  importedSkills: string[];
}

interface GuideShowResult {
  context: GuideContext;
}

interface GuideAskResult {
  question: string;
  answerType: "progression" | "wiki";
  username?: string;
  answer: string;
  route?: SkillQuestionResult["route"];
  matches: WikiQuestionResult["matches"];
}

async function main(): Promise<void> {
  const parsed = stripBooleanFlag(process.argv.slice(2), "--json");
  const args = parsed.args;
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    if (parsed.enabled) {
      printJson({
        mode: "guide",
        ok: true,
        help: renderHelp()
      });
      return;
    }

    console.log(renderHelp());
    return;
  }

  if (command === "set") {
    const result = await handleSet(args.slice(1));
    if (parsed.enabled) {
      printJson({
        mode: "guide",
        ok: true,
        operation: "set",
        ...result
      });
      return;
    }

    renderSetResult(result);
    return;
  }

  if (command === "import") {
    const result = await handleImport(args.slice(1));
    if (parsed.enabled) {
      printJson({
        mode: "guide",
        ok: true,
        operation: "import",
        ...result
      });
      return;
    }

    renderImportResult(result);
    return;
  }

  if (command === "show") {
    const result = await handleShow();
    if (parsed.enabled) {
      printJson({
        mode: "guide",
        ok: true,
        operation: "show",
        ...result
      });
      return;
    }

    renderShowResult(result);
    return;
  }

  if (command === "reset") {
    await handleReset();
    if (parsed.enabled) {
      printJson({
        mode: "guide",
        ok: true,
        operation: "reset"
      });
      return;
    }

    renderResetResult();
    return;
  }

  if (command === "ask") {
    const result = await handleAsk(args.slice(1));
    if (parsed.enabled) {
      printJson({
        mode: "guide",
        ok: true,
        operation: "ask",
        ...result
      });
      return;
    }

    renderAskResult(result);
    return;
  }

  throw new Error(renderHelp());
}

async function handleSet(args: string[]): Promise<GuideSetResult> {
  const username = readFlagValue(args, "--username");
  if (!username) {
    throw new Error('Usage: pnpm guide set [--json] --username "your_name"');
  }

  const existing = await loadGuideContext();
  await saveGuideContext({
    ...existing,
    username
  });

  return {
    username
  };
}

async function handleImport(args: string[]): Promise<GuideImportResult> {
  const exportFile = readFlagValue(args, "--character-export-file");
  const exportJson = readFlagValue(args, "--character-export-json");

  if (!exportFile && !exportJson) {
    throw new Error(
      "Usage: pnpm guide import [--json] --character-export-file <path> OR --character-export-json '<json>'"
    );
  }

  const rawJson = exportFile ? await fs.readFile(exportFile, "utf-8") : (exportJson ?? "");
  const imported = parseCharacterExport(rawJson);
  const existing = await loadGuideContext();

  const merged: GuideContext = {
    username: imported.username ?? existing.username,
    skillLevels: {
      ...existing.skillLevels,
      ...imported.skillLevels
    }
  };

  await saveGuideContext(merged);
  const importedSkills = Object.keys(imported.skillLevels);

  return {
    context: merged,
    importedSkills
  };
}

async function handleShow(): Promise<GuideShowResult> {
  const context = await loadGuideContext();

  return {
    context
  };
}

async function handleReset(): Promise<void> {
  await resetGuideContext();
}

async function handleAsk(args: string[]): Promise<GuideAskResult> {
  const question = args.join(" ").trim();
  if (!question) {
    throw new Error('Usage: pnpm guide ask [--json] "how do i get fishing to 55?"');
  }

  const context = await loadGuideContext();
  if (isProgressionQuestion(question)) {
    const skillResult = await runLocalSkillQuestion(question, {
      guideContext: {
        username: context.username,
        skillLevels: context.skillLevels as Record<string, number>
      }
    });

    return {
      question,
      answerType: "progression",
      username: context.username,
      answer: skillResult.answer,
      route: skillResult.route,
      matches: []
    };
  }

  const wikiResult = await runLocalWikiQuestion(question);

  return {
    question,
    answerType: "wiki",
    username: context.username,
    answer: context.username
      ? `${context.username}, quick detour answer incoming:\n${wikiResult.answer}`
      : `Quick detour answer incoming:\n${wikiResult.answer}`,
    matches: wikiResult.matches
  };
}

function renderSetResult(result: GuideSetResult): void {
  console.log("=== Guide Profile Updated ===");
  console.log(`Username saved: ${result.username}`);
}

function renderImportResult(result: GuideImportResult): void {
  console.log("=== Guide Import Complete ===");
  console.log(`Username: ${result.context.username ?? "(not set)"}`);
  console.log(
    `Skills loaded (${result.importedSkills.length}): ${result.importedSkills.join(", ")}`
  );
}

function renderShowResult(result: GuideShowResult): void {
  const width = SKILL_NAMES.reduce((max, skill) => Math.max(max, skill.length), 0);

  console.log("=== Guide Profile ===");
  console.log(`Username: ${result.context.username ?? "(not set)"}`);
  console.log("Skill levels:");

  for (const skill of SKILL_NAMES) {
    const padded = skill.padEnd(width, " ");
    const level = result.context.skillLevels[skill] ?? "unknown";
    console.log(`- ${padded} : ${level}`);
  }
}

function renderResetResult(): void {
  console.log("=== Guide Profile Reset ===");
  console.log("Guide context cleared. Fresh adventure, clean slate.");
}

function renderAskResult(result: GuideAskResult): void {
  console.log("=== Guide Answer ===");
  console.log(`Question: ${result.question}`);
  if (result.username) {
    console.log(`Profile: ${result.username}`);
  }

  console.log("");
  console.log(result.answer);

  if (result.answerType === "wiki" && result.matches.length) {
    console.log("");
    console.log("Top matches:");
    for (const [index, match] of result.matches.slice(0, 5).entries()) {
      console.log(`${index + 1}. ${match.id} (score ${match.score.toFixed(3)})`);
    }
  }
}

function readFlagValue(args: string[], flagName: string): string | undefined {
  const index = args.indexOf(flagName);
  if (index < 0) {
    return undefined;
  }

  const value = args[index + 1];
  if (!value) {
    throw new Error(`Missing value for ${flagName}`);
  }

  return value;
}

function isProgressionQuestion(question: string): boolean {
  const lower = question.toLowerCase();
  const hasSkill = SKILL_NAMES.some((skill) => lower.includes(skill));
  if (!hasSkill) {
    return false;
  }

  return /(from|to|level|lvl|route|progress|train|get\s+.+\s+to)\b/i.test(lower);
}

function renderHelp(): string {
  return [
    "Guide command - save character context and ask personalized questions",
    "",
    "Usage:",
    "  pnpm guide [--json] set --username <name>",
    "  pnpm guide [--json] import --character-export-file <path>",
    "  pnpm guide [--json] import --character-export-json '<json>'",
    "  pnpm guide [--json] show",
    "  pnpm guide [--json] reset",
    '  pnpm guide [--json] ask "how do i get fishing to 55?"',
    "",
    "Output modes:",
    "  default output is tuned for humans in the terminal",
    "  pass --json for machine-readable output",
    ""
  ].join("\n");
}

const jsonMode = process.argv.includes("--json");

void main().catch((error: unknown) => {
  printCommandError("guide", error, jsonMode);
  process.exitCode = 1;
});

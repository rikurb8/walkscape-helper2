import { promises as fs } from "node:fs";

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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    throw new Error(renderHelp());
  }

  if (command === "set") {
    await handleSet(args.slice(1));
    return;
  }

  if (command === "import") {
    await handleImport(args.slice(1));
    return;
  }

  if (command === "show") {
    await handleShow();
    return;
  }

  if (command === "reset") {
    await resetGuideContext();
    console.log("Guide context reset.");
    return;
  }

  if (command === "ask") {
    await handleAsk(args.slice(1));
    return;
  }

  throw new Error(renderHelp());
}

async function handleSet(args: string[]): Promise<void> {
  const username = readFlagValue(args, "--username");
  if (!username) {
    throw new Error('Usage: pnpm guide set --username "your_name"');
  }

  const existing = await loadGuideContext();
  await saveGuideContext({
    ...existing,
    username
  });

  console.log(`Guide username saved: ${username}`);
}

async function handleImport(args: string[]): Promise<void> {
  const exportFile = readFlagValue(args, "--character-export-file");
  const exportJson = readFlagValue(args, "--character-export-json");

  if (!exportFile && !exportJson) {
    throw new Error(
      "Usage: pnpm guide import --character-export-file <path> OR --character-export-json '<json>'"
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
  console.log(
    `Imported guide context${merged.username ? ` for ${merged.username}` : ""}. Skills loaded: ${importedSkills.join(", ")}`
  );
}

async function handleShow(): Promise<void> {
  const context = await loadGuideContext();
  const lines = [
    `username: ${context.username ?? "(not set)"}`,
    "skills:",
    ...SKILL_NAMES.map((skill) => `- ${skill}: ${context.skillLevels[skill] ?? "(unknown)"}`)
  ];

  console.log(lines.join("\n"));
}

async function handleAsk(args: string[]): Promise<void> {
  const question = args.join(" ").trim();
  if (!question) {
    throw new Error('Usage: pnpm guide ask "how do i get fishing to 55?"');
  }

  const context = await loadGuideContext();
  if (isProgressionQuestion(question)) {
    const skillResult = await runLocalSkillQuestion(question, {
      guideContext: {
        username: context.username,
        skillLevels: context.skillLevels as Record<string, number>
      }
    });
    console.log(skillResult.answer);
    return;
  }

  const wikiResult = await runLocalWikiQuestion(question);
  if (context.username) {
    console.log(`${context.username}, ${wikiResult.answer}`);
    return;
  }

  console.log(wikiResult.answer);
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
    "  pnpm guide set --username <name>",
    "  pnpm guide import --character-export-file <path>",
    "  pnpm guide import --character-export-json '<json>'",
    "  pnpm guide show",
    "  pnpm guide reset",
    '  pnpm guide ask "how do i get fishing to 55?"',
    ""
  ].join("\n");
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

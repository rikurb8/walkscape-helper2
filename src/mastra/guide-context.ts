import { promises as fs } from "node:fs";
import path from "node:path";

const GUIDE_CONTEXT_FILE = path.join(process.cwd(), ".walkscape", "guide-context.json");
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

export interface GuideContext {
  username?: string;
  skillLevels: Partial<Record<(typeof SKILL_NAMES)[number], number>>;
}

export async function loadGuideContext(): Promise<GuideContext> {
  try {
    const text = await fs.readFile(GUIDE_CONTEXT_FILE, "utf-8");
    const parsed = JSON.parse(text) as { username?: unknown; skillLevels?: unknown };

    return {
      username:
        typeof parsed.username === "string" && parsed.username.trim() ? parsed.username : undefined,
      skillLevels: normalizeSkillLevels(parsed.skillLevels)
    };
  } catch (error: unknown) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return { skillLevels: {} };
    }

    throw error;
  }
}

export async function saveGuideContext(context: GuideContext): Promise<void> {
  const normalizedContext: GuideContext = {
    username: context.username?.trim() || undefined,
    skillLevels: normalizeSkillLevels(context.skillLevels)
  };

  await fs.mkdir(path.dirname(GUIDE_CONTEXT_FILE), { recursive: true });
  await fs.writeFile(
    GUIDE_CONTEXT_FILE,
    `${JSON.stringify(normalizedContext, null, 2)}\n`,
    "utf-8"
  );
}

export async function resetGuideContext(): Promise<void> {
  try {
    await fs.rm(GUIDE_CONTEXT_FILE);
  } catch (error: unknown) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

export function parseCharacterExport(input: string): GuideContext {
  let payload: unknown;
  try {
    payload = JSON.parse(input);
  } catch {
    throw new Error("Character export must be valid JSON");
  }

  const skillLevels = extractSkillLevels(payload);
  if (!Object.keys(skillLevels).length) {
    throw new Error(
      "Could not find known skill levels in character export JSON. Expected fields such as skill names with numeric levels."
    );
  }

  const username = extractUsername(payload);

  return {
    username,
    skillLevels
  };
}

function extractSkillLevels(payload: unknown): GuideContext["skillLevels"] {
  const skillLevels: GuideContext["skillLevels"] = {};
  const visited = new Set<unknown>();

  scanNode(payload, skillLevels, visited);
  return skillLevels;
}

function scanNode(
  node: unknown,
  skillLevels: GuideContext["skillLevels"],
  visited: Set<unknown>
): void {
  if (!node || typeof node !== "object") {
    return;
  }

  if (visited.has(node)) {
    return;
  }
  visited.add(node);

  if (Array.isArray(node)) {
    for (const entry of node) {
      scanNode(entry, skillLevels, visited);
    }
    return;
  }

  const entries = Object.entries(node);

  for (const [key, value] of entries) {
    const normalizedKey = normalizeKey(key);
    const skillName = toKnownSkill(normalizedKey);
    if (skillName) {
      const directLevel = readLevelValue(value);
      if (typeof directLevel === "number") {
        setSkillLevel(skillLevels, skillName, directLevel);
      }
    }
  }

  const namedSkill = inferNamedSkill(node);
  if (namedSkill) {
    const levelValue = inferObjectLevel(node);
    if (typeof levelValue === "number") {
      setSkillLevel(skillLevels, namedSkill, levelValue);
    }
  }

  for (const value of Object.values(node)) {
    scanNode(value, skillLevels, visited);
  }
}

function inferNamedSkill(node: object): (typeof SKILL_NAMES)[number] | null {
  const candidateKeys = ["skill", "name", "title", "type"];
  for (const key of candidateKeys) {
    const value = (node as Record<string, unknown>)[key];
    if (typeof value !== "string") {
      continue;
    }

    const skill = toKnownSkill(normalizeKey(value));
    if (skill) {
      return skill;
    }
  }

  return null;
}

function inferObjectLevel(node: object): number | null {
  const candidateKeys = ["level", "lvl", "currentLevel", "current_level", "value", "xp"];
  for (const key of candidateKeys) {
    const value = (node as Record<string, unknown>)[key];
    const level = readSkillLevelValue(value, key === "xp");
    if (typeof level === "number") {
      return level;
    }
  }

  return null;
}

function readLevelValue(value: unknown): number | null {
  return readSkillLevelValue(value, false);
}

function readSkillLevelValue(value: unknown, treatAsXp: boolean): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (treatAsXp || value > 99) {
      return xpToEstimatedLevel(value);
    }

    return sanitizeLevel(value);
  }

  if (typeof value === "string") {
    const match = value.trim().match(/^(\d+)$/);
    if (!match) {
      return null;
    }

    const parsed = Number.parseInt(match[1], 10);
    if (treatAsXp || parsed > 99) {
      return xpToEstimatedLevel(parsed);
    }

    return sanitizeLevel(parsed);
  }

  if (value && typeof value === "object") {
    return inferObjectLevel(value);
  }

  return null;
}

function sanitizeLevel(value: number): number | null {
  if (!Number.isInteger(value) || value < 1 || value > 99) {
    return null;
  }

  return value;
}

function extractUsername(payload: unknown): string | undefined {
  const visited = new Set<unknown>();
  return scanUsername(payload, visited);
}

function scanUsername(node: unknown, visited: Set<unknown>): string | undefined {
  if (!node || typeof node !== "object") {
    return undefined;
  }

  if (visited.has(node)) {
    return undefined;
  }
  visited.add(node);

  if (Array.isArray(node)) {
    for (const entry of node) {
      const username = scanUsername(entry, visited);
      if (username) {
        return username;
      }
    }
    return undefined;
  }

  const usernameKeys = [
    "username",
    "user_name",
    "playername",
    "player_name",
    "charactername",
    "name"
  ];
  for (const [key, value] of Object.entries(node)) {
    if (!usernameKeys.includes(normalizeKey(key))) {
      continue;
    }

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  for (const value of Object.values(node)) {
    const username = scanUsername(value, visited);
    if (username) {
      return username;
    }
  }

  return undefined;
}

function normalizeSkillLevels(value: unknown): GuideContext["skillLevels"] {
  if (!value || typeof value !== "object") {
    return {};
  }

  const output: GuideContext["skillLevels"] = {};
  for (const [key, rawLevel] of Object.entries(value)) {
    const skill = toKnownSkill(normalizeKey(key));
    if (!skill) {
      continue;
    }

    const level = readSkillLevelValue(rawLevel, false);
    if (typeof level === "number") {
      output[skill] = level;
    }
  }

  return output;
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function toKnownSkill(value: string): (typeof SKILL_NAMES)[number] | null {
  for (const skill of SKILL_NAMES) {
    if (normalizeKey(skill) === value) {
      return skill;
    }
  }

  return null;
}

function setSkillLevel(
  skillLevels: GuideContext["skillLevels"],
  skill: (typeof SKILL_NAMES)[number],
  level: number
): void {
  const current = skillLevels[skill] ?? 0;
  if (level > current) {
    skillLevels[skill] = level;
  }
}

function xpToEstimatedLevel(xp: number): number | null {
  if (!Number.isFinite(xp) || xp < 0) {
    return null;
  }

  const normalizedXp = Math.floor(xp);
  let points = 0;
  let level = 1;

  for (let targetLevel = 1; targetLevel <= 99; targetLevel += 1) {
    if (targetLevel > 1) {
      const increment = Math.floor(targetLevel - 1 + 300 * Math.pow(2, (targetLevel - 1) / 7));
      points += increment;
    }

    const requiredXp = Math.floor(points / 4);
    if (normalizedXp >= requiredXp) {
      level = targetLevel;
      continue;
    }

    break;
  }

  return level;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

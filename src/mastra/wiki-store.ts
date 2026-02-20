import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { extractDocument } from "../scraper/extract.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");

export interface SkillActivity {
  activityName: string;
  locations: string;
  skills: string;
  requiredLevel: number;
  totalBaseXpPerStep: number | null;
  totalMaxXpPerStep: number | null;
  minimumSteps: number | null;
}

export interface SkillConsumable {
  itemName: string;
  attributes: string;
  duration: string;
}

export interface SkillPageData {
  skill: string;
  activities: SkillActivity[];
  consumables: SkillConsumable[];
}

const pageCache = new Map<string, SkillPageData>();

export async function loadSkillPage(skill: string): Promise<SkillPageData> {
  const normalizedSkill = normalizeSkillName(skill);
  const cacheKey = normalizedSkill.toLowerCase();
  const cached = pageCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const filePath = path.join(
    PROJECT_ROOT,
    "data",
    "raw",
    "skills",
    `${skillToSlug(skill)}_parse.json`
  );
  const text = await fs.readFile(filePath, "utf-8");
  const payload = JSON.parse(text) as { parse?: { text?: unknown } };
  const html = payload.parse?.text;

  if (typeof html !== "string") {
    throw new Error(`Invalid skill payload for '${skill}' at ${filePath}`);
  }

  const extracted = extractDocument(html);
  const activities = extractActivities(extracted.tables, normalizedSkill);
  const consumables = extractConsumables(extracted.tables, normalizedSkill);

  const page: SkillPageData = {
    skill: normalizedSkill,
    activities,
    consumables
  };

  pageCache.set(cacheKey, page);
  return page;
}

function extractActivities(
  tables: { section: string; rows: Record<string, string>[] }[],
  skill: string
): SkillActivity[] {
  const activitiesTable = tables.find((table) => table.section.toLowerCase() === "activities");
  if (!activitiesTable) {
    return [];
  }

  const rows: SkillActivity[] = [];
  for (const row of activitiesTable.rows) {
    const skills = row["Skills"] ?? "";
    const requiredLevel = parseRequiredLevel(skills, skill);
    if (requiredLevel === null) {
      continue;
    }

    rows.push({
      activityName: row["Activity Name"] ?? "",
      locations: row["Locations"] ?? "",
      skills,
      requiredLevel,
      totalBaseXpPerStep: parseFloatSafe(row["Total Base XP/Step"]),
      totalMaxXpPerStep: parseFloatSafe(row["Total Max XP/Step"]),
      minimumSteps: parseIntSafe(row["Minimum Steps"])
    });
  }

  return rows;
}

function extractConsumables(
  tables: { section: string; rows: Record<string, string>[] }[],
  skill: string
): SkillConsumable[] {
  const consumablesTable = tables.find((table) => table.section.toLowerCase() === "consumables");
  if (!consumablesTable) {
    return [];
  }

  return consumablesTable.rows
    .filter((row) => {
      const attributes = row["Attributes"] ?? "";
      return (
        attributes.toLowerCase().includes(skill.toLowerCase()) || attributes.includes("Gathering")
      );
    })
    .map((row) => ({
      itemName: row["Item Name"] ?? "",
      attributes: row["Attributes"] ?? "",
      duration: row["Duration"] ?? ""
    }));
}

function parseRequiredLevel(skillsText: string, skill: string): number | null {
  const pattern = new RegExp(`${escapeRegExp(skill)}\\s+lvl\\.\\s*(\\d+)`, "i");
  const match = skillsText.match(pattern);
  if (!match) {
    return null;
  }

  const requiredLevel = Number.parseInt(match[1], 10);
  return Number.isNaN(requiredLevel) ? null : requiredLevel;
}

function parseFloatSafe(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isNaN(parsed) ? null : parsed;
}

function parseIntSafe(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value.replace(/,/g, ""), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeSkillName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Skill name cannot be empty");
  }

  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1).toLowerCase()}`;
}

function skillToSlug(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

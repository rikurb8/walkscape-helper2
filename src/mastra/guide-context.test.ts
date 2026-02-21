import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseCharacterExport } from "./guide-context.js";
import { runLocalSkillQuestion } from "./index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const FISHING_PARSE_PATH = path.join(PROJECT_ROOT, "data", "raw", "skills", "fishing_parse.json");

test("parseCharacterExport reads username and skill levels", () => {
  const parsed = parseCharacterExport(
    JSON.stringify({
      username: "riku",
      skills: {
        fishing: { level: 34 },
        woodcutting: "18"
      },
      extra: [{ skill: "Mining", level: 22 }]
    })
  );

  assert.equal(parsed.username, "riku");
  assert.equal(parsed.skillLevels.fishing, 34);
  assert.equal(parsed.skillLevels.woodcutting, 18);
  assert.equal(parsed.skillLevels.mining, 22);
});

test("parseCharacterExport supports exported skill xp payloads", () => {
  const parsed = parseCharacterExport(
    JSON.stringify({
      name: "Riku1",
      skills: {
        fishing: 189454,
        mining: 630471,
        trinketry: 40
      }
    })
  );

  assert.equal(parsed.username, "Riku1");
  assert.equal(parsed.skillLevels.fishing, 56);
  assert.equal(parsed.skillLevels.mining, 68);
  assert.equal(parsed.skillLevels.trinketry, 40);
});

test("runLocalSkillQuestion uses guide profile levels for target-only question", async (t) => {
  if (!(await hasFishingData())) {
    t.skip(`requires ${FISHING_PARSE_PATH}`);
    return;
  }

  const result = await runLocalSkillQuestion("how do i get fishing to 55?", {
    guideContext: {
      username: "riku",
      skillLevels: {
        fishing: 30
      }
    }
  });

  assert.equal(result.route.fromLevel, 30);
  assert.equal(result.route.toLevel, 55);
  assert.match(result.answer, /route:/i);
  assert.match(result.answer, /30\s*(to|-)\s*55/i);
});

test("runLocalSkillQuestion fails clearly when current level is missing", async (t) => {
  if (!(await hasFishingData())) {
    t.skip(`requires ${FISHING_PARSE_PATH}`);
    return;
  }

  await assert.rejects(
    async () => runLocalSkillQuestion("how do i get fishing to 55?"),
    /requires your current fishing level/i
  );
});

async function hasFishingData(): Promise<boolean> {
  try {
    await fs.access(FISHING_PARSE_PATH);
    return true;
  } catch {
    return false;
  }
}

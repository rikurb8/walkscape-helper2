import { loadSkillPage, type SkillActivity, type SkillConsumable } from "./wiki-store.js";

export interface SkillRouteInput {
  skill: string;
  currentLevel: number;
  targetLevel: number;
}

export interface SkillRouteSegment {
  fromLevel: number;
  toLevel: number;
  activityName: string;
  location: string;
  requiredLevel: number;
  totalMaxXpPerStep: number | null;
  totalBaseXpPerStep: number | null;
}

export interface SkillRoutePlan {
  skill: string;
  fromLevel: number;
  toLevel: number;
  segments: SkillRouteSegment[];
  consumables: SkillConsumable[];
}

export async function buildSkillRoutePlan(input: SkillRouteInput): Promise<SkillRoutePlan> {
  validateLevels(input.currentLevel, input.targetLevel);

  const skillData = await loadSkillPage(input.skill);
  const candidates = skillData.activities
    .filter((activity) => activity.requiredLevel <= input.targetLevel)
    .sort((left, right) => left.requiredLevel - right.requiredLevel);

  if (!candidates.length) {
    throw new Error(`No activities found for skill '${skillData.skill}'`);
  }

  const boundaries = buildLevelBoundaries(candidates, input.currentLevel, input.targetLevel);
  const segments: SkillRouteSegment[] = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const fromLevel = boundaries[index];
    const toLevel = boundaries[index + 1];
    const best = selectBestActivity(candidates, fromLevel);
    if (!best) {
      throw new Error(
        `No available ${skillData.skill} activity at level ${fromLevel}. Check local data completeness.`
      );
    }

    const previous = segments.at(-1);
    if (previous && previous.activityName === best.activityName && previous.toLevel === fromLevel) {
      previous.toLevel = toLevel;
      continue;
    }

    segments.push({
      fromLevel,
      toLevel,
      activityName: best.activityName,
      location: best.locations,
      requiredLevel: best.requiredLevel,
      totalMaxXpPerStep: best.totalMaxXpPerStep,
      totalBaseXpPerStep: best.totalBaseXpPerStep
    });
  }

  return {
    skill: skillData.skill,
    fromLevel: input.currentLevel,
    toLevel: input.targetLevel,
    segments,
    consumables: skillData.consumables
  };
}

function validateLevels(currentLevel: number, targetLevel: number): void {
  if (!Number.isInteger(currentLevel) || !Number.isInteger(targetLevel)) {
    throw new Error("Current level and target level must be integers");
  }

  if (currentLevel < 1 || targetLevel < 1) {
    throw new Error("Current level and target level must be at least 1");
  }

  if (targetLevel <= currentLevel) {
    throw new Error("Target level must be greater than current level");
  }
}

function buildLevelBoundaries(
  candidates: SkillActivity[],
  currentLevel: number,
  targetLevel: number
): number[] {
  const unlocks = new Set<number>([currentLevel, targetLevel]);

  for (const activity of candidates) {
    if (activity.requiredLevel > currentLevel && activity.requiredLevel < targetLevel) {
      unlocks.add(activity.requiredLevel);
    }
  }

  return [...unlocks].sort((left, right) => left - right);
}

function selectBestActivity(candidates: SkillActivity[], level: number): SkillActivity | null {
  const available = candidates.filter((candidate) => candidate.requiredLevel <= level);
  if (!available.length) {
    return null;
  }

  return available.sort(compareByEfficiency)[0];
}

function compareByEfficiency(left: SkillActivity, right: SkillActivity): number {
  const leftScore = getEfficiencyScore(left);
  const rightScore = getEfficiencyScore(right);

  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  const leftSteps = left.minimumSteps ?? Number.POSITIVE_INFINITY;
  const rightSteps = right.minimumSteps ?? Number.POSITIVE_INFINITY;
  if (leftSteps !== rightSteps) {
    return leftSteps - rightSteps;
  }

  return left.activityName.localeCompare(right.activityName);
}

function getEfficiencyScore(activity: SkillActivity): number {
  if (typeof activity.totalMaxXpPerStep === "number") {
    return activity.totalMaxXpPerStep;
  }

  if (typeof activity.totalBaseXpPerStep === "number") {
    return activity.totalBaseXpPerStep;
  }

  return Number.NEGATIVE_INFINITY;
}

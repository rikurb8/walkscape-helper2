import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { buildSkillRoutePlan } from "../skill-route-planner.js";

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

const parseQuestionStep = createStep({
  id: "parse-question",
  inputSchema: z.object({
    question: z.string().min(1),
    context: z
      .object({
        username: z.string().min(1).optional(),
        skillLevels: z.record(z.number().int().min(1)).optional()
      })
      .optional()
  }),
  outputSchema: z.object({
    skill: z.string(),
    currentLevel: z.number().int().min(1),
    targetLevel: z.number().int().min(2),
    username: z.string().optional(),
    usedProfileLevel: z.boolean()
  }),
  execute: async ({ inputData }) => {
    const question = inputData.question.trim();
    const questionLower = question.toLowerCase();

    const skill = SKILL_NAMES.find((entry) => questionLower.includes(entry));
    if (!skill) {
      throw new Error(`Could not infer a known skill from question: '${question}'`);
    }

    const levels = extractLevelRange(questionLower);
    if (levels) {
      return {
        skill,
        currentLevel: levels.currentLevel,
        targetLevel: levels.targetLevel,
        username: inputData.context?.username,
        usedProfileLevel: false
      };
    }

    const targetLevel = extractTargetLevel(questionLower);
    if (!targetLevel) {
      throw new Error(
        `Could not parse level target from question: '${question}'. Expected formats like '30 to 55', '30-55', or 'to 55'.`
      );
    }

    const profileLevel = inputData.context?.skillLevels?.[skill];
    if (!profileLevel) {
      throw new Error(
        `Question '${question}' requires your current ${skill} level. Provide it in the question (for example '30 to ${targetLevel}') or import your character export with guide.`
      );
    }

    return {
      skill,
      currentLevel: profileLevel,
      targetLevel,
      username: inputData.context?.username,
      usedProfileLevel: true
    };
  }
});

const planRouteStep = createStep({
  id: "plan-route",
  inputSchema: z.object({
    skill: z.string(),
    currentLevel: z.number(),
    targetLevel: z.number(),
    username: z.string().optional(),
    usedProfileLevel: z.boolean()
  }),
  outputSchema: z.object({
    skill: z.string(),
    fromLevel: z.number(),
    toLevel: z.number(),
    username: z.string().optional(),
    usedProfileLevel: z.boolean(),
    segments: z.array(
      z.object({
        fromLevel: z.number(),
        toLevel: z.number(),
        activityName: z.string(),
        location: z.string(),
        requiredLevel: z.number(),
        totalMaxXpPerStep: z.number().nullable(),
        totalBaseXpPerStep: z.number().nullable()
      })
    ),
    consumables: z.array(
      z.object({
        itemName: z.string(),
        attributes: z.string(),
        duration: z.string()
      })
    )
  }),
  execute: async ({ inputData }) => {
    const route = await buildSkillRoutePlan({
      skill: inputData.skill,
      currentLevel: inputData.currentLevel,
      targetLevel: inputData.targetLevel
    });

    return {
      ...route,
      username: inputData.username,
      usedProfileLevel: inputData.usedProfileLevel
    };
  }
});

const formatAnswerStep = createStep({
  id: "format-answer",
  inputSchema: z.object({
    skill: z.string(),
    fromLevel: z.number(),
    toLevel: z.number(),
    username: z.string().optional(),
    usedProfileLevel: z.boolean(),
    segments: z.array(
      z.object({
        fromLevel: z.number(),
        toLevel: z.number(),
        activityName: z.string(),
        location: z.string(),
        requiredLevel: z.number(),
        totalMaxXpPerStep: z.number().nullable(),
        totalBaseXpPerStep: z.number().nullable()
      })
    ),
    consumables: z.array(
      z.object({
        itemName: z.string(),
        attributes: z.string(),
        duration: z.string()
      })
    )
  }),
  outputSchema: z.object({
    answer: z.string(),
    route: z.object({
      skill: z.string(),
      fromLevel: z.number(),
      toLevel: z.number(),
      segments: z.array(
        z.object({
          fromLevel: z.number(),
          toLevel: z.number(),
          activityName: z.string(),
          location: z.string(),
          requiredLevel: z.number(),
          totalMaxXpPerStep: z.number().nullable(),
          totalBaseXpPerStep: z.number().nullable()
        })
      ),
      consumables: z.array(
        z.object({
          itemName: z.string(),
          attributes: z.string(),
          duration: z.string()
        })
      )
    })
  }),
  execute: async ({ inputData }) => {
    const titleSkill = `${inputData.skill.charAt(0).toUpperCase()}${inputData.skill.slice(1)}`;
    const introPrefix = inputData.username ? `${inputData.username}, ` : "";
    const contextLine = inputData.usedProfileLevel
      ? `Using your saved profile level (${titleSkill} ${inputData.fromLevel}) as the starting point.`
      : "";
    const routeLines = inputData.segments.map((segment) => {
      const xp = segment.totalMaxXpPerStep ?? segment.totalBaseXpPerStep;
      const xpText = typeof xp === "number" ? xp.toFixed(3) : "n/a";
      return `- ${segment.fromLevel}-${segment.toLevel}: ${segment.activityName} @ ${segment.location} (req lvl ${segment.requiredLevel}, xp/step ${xpText})`;
    });

    const consumableLines = inputData.consumables.slice(0, 5).map((entry) => {
      return `- ${entry.itemName}: ${entry.attributes}`;
    });

    const answer = [
      `${introPrefix}${titleSkill} ${inputData.fromLevel}-${inputData.toLevel} route (local wiki data):`,
      contextLine,
      ...routeLines,
      consumableLines.length ? "" : "",
      consumableLines.length ? "Helpful consumables:" : "",
      ...consumableLines
    ]
      .filter(Boolean)
      .join("\n");

    return {
      answer,
      route: {
        skill: inputData.skill,
        fromLevel: inputData.fromLevel,
        toLevel: inputData.toLevel,
        segments: inputData.segments,
        consumables: inputData.consumables
      }
    };
  }
});

export const answerSkillQuestionWorkflow = createWorkflow({
  id: "answer-skill-question",
  description: "Answers progression questions using local scraped WalkScape wiki data only",
  inputSchema: z.object({
    question: z.string().min(1),
    context: z
      .object({
        username: z.string().min(1).optional(),
        skillLevels: z.record(z.number().int().min(1)).optional()
      })
      .optional()
  }),
  outputSchema: z.object({
    answer: z.string(),
    route: z.object({
      skill: z.string(),
      fromLevel: z.number(),
      toLevel: z.number(),
      segments: z.array(
        z.object({
          fromLevel: z.number(),
          toLevel: z.number(),
          activityName: z.string(),
          location: z.string(),
          requiredLevel: z.number(),
          totalMaxXpPerStep: z.number().nullable(),
          totalBaseXpPerStep: z.number().nullable()
        })
      ),
      consumables: z.array(
        z.object({
          itemName: z.string(),
          attributes: z.string(),
          duration: z.string()
        })
      )
    })
  })
})
  .then(parseQuestionStep)
  .then(planRouteStep)
  .then(formatAnswerStep)
  .commit();

function extractLevelRange(question: string): { currentLevel: number; targetLevel: number } | null {
  const fromToMatch = question.match(/(?:from\s+)?(\d+)\s*(?:to|-)\s*(\d+)/i);
  if (!fromToMatch) {
    return null;
  }

  const currentLevel = Number.parseInt(fromToMatch[1], 10);
  const targetLevel = Number.parseInt(fromToMatch[2], 10);
  if (Number.isNaN(currentLevel) || Number.isNaN(targetLevel)) {
    return null;
  }

  return { currentLevel, targetLevel };
}

function extractTargetLevel(question: string): number | null {
  const targetMatch = question.match(/(?:to|target(?:\s+level)?|lvl\.?|level)\s*(\d+)/i);
  if (!targetMatch) {
    return null;
  }

  const targetLevel = Number.parseInt(targetMatch[1], 10);
  if (Number.isNaN(targetLevel)) {
    return null;
  }

  return targetLevel;
}

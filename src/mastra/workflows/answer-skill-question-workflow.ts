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
    question: z.string().min(1)
  }),
  outputSchema: z.object({
    skill: z.string(),
    currentLevel: z.number().int().min(1),
    targetLevel: z.number().int().min(2)
  }),
  execute: async ({ inputData }) => {
    const question = inputData.question.trim();
    const questionLower = question.toLowerCase();

    const skill = SKILL_NAMES.find((entry) => questionLower.includes(entry));
    if (!skill) {
      throw new Error(`Could not infer a known skill from question: '${question}'`);
    }

    const levels = extractLevelRange(questionLower);
    if (!levels) {
      throw new Error(
        `Could not parse level range from question: '${question}'. Expected formats like '30 to 55' or '30-55'.`
      );
    }

    return {
      skill,
      currentLevel: levels.currentLevel,
      targetLevel: levels.targetLevel
    };
  }
});

const planRouteStep = createStep({
  id: "plan-route",
  inputSchema: z.object({
    skill: z.string(),
    currentLevel: z.number(),
    targetLevel: z.number()
  }),
  outputSchema: z.object({
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
  }),
  execute: async ({ inputData }) => {
    return buildSkillRoutePlan({
      skill: inputData.skill,
      currentLevel: inputData.currentLevel,
      targetLevel: inputData.targetLevel
    });
  }
});

const formatAnswerStep = createStep({
  id: "format-answer",
  inputSchema: z.object({
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
    const routeLines = inputData.segments.map((segment) => {
      const xp = segment.totalMaxXpPerStep ?? segment.totalBaseXpPerStep;
      const xpText = typeof xp === "number" ? xp.toFixed(3) : "n/a";
      return `- ${segment.fromLevel}-${segment.toLevel}: ${segment.activityName} @ ${segment.location} (req lvl ${segment.requiredLevel}, xp/step ${xpText})`;
    });

    const consumableLines = inputData.consumables.slice(0, 5).map((entry) => {
      return `- ${entry.itemName}: ${entry.attributes}`;
    });

    const answer = [
      `${titleSkill} ${inputData.fromLevel}-${inputData.toLevel} route (local wiki data):`,
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
    question: z.string().min(1)
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

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { buildSkillRoutePlan } from "../skill-route-planner.js";

export const skillRoutePlannerTool = createTool({
  id: "skill-route-planner",
  description: "Builds a level-by-level activity route using local WalkScape wiki scrape data",
  inputSchema: z.object({
    skill: z.string().min(1),
    currentLevel: z.number().int().min(1),
    targetLevel: z.number().int().min(2)
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
  execute: async (inputData) => {
    return buildSkillRoutePlan(inputData);
  }
});

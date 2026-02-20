import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { loadSkillPage } from "../wiki-store.js";

export const wikiSkillDataTool = createTool({
  id: "wiki-skill-data",
  description: "Reads local skill page data from scraped WalkScape wiki files",
  inputSchema: z.object({
    skill: z.string().min(1)
  }),
  outputSchema: z.object({
    skill: z.string(),
    activities: z.array(
      z.object({
        activityName: z.string(),
        locations: z.string(),
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
  execute: async ({ skill }) => {
    const page = await loadSkillPage(skill);

    return {
      skill: page.skill,
      activities: page.activities.map((activity) => ({
        activityName: activity.activityName,
        locations: activity.locations,
        requiredLevel: activity.requiredLevel,
        totalMaxXpPerStep: activity.totalMaxXpPerStep,
        totalBaseXpPerStep: activity.totalBaseXpPerStep
      })),
      consumables: page.consumables
    };
  }
});

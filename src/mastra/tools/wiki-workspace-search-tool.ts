import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { searchLocalWiki } from "../wiki-workspace.js";

const MAX_SNIPPET_CHARS = 400;

export const wikiWorkspaceSearchTool = createTool({
  id: "wiki-workspace-search",
  description: "Searches local scraped WalkScape wiki content indexed from data/raw and docs/wiki",
  inputSchema: z.object({
    query: z.string().min(1),
    topK: z.number().int().min(1).max(20).optional()
  }),
  outputSchema: z.object({
    query: z.string(),
    matches: z.array(
      z.object({
        id: z.string(),
        score: z.number(),
        snippet: z.string(),
        lineRange: z
          .object({
            start: z.number(),
            end: z.number()
          })
          .optional()
      })
    )
  }),
  execute: async ({ query, topK }) => {
    const results = await searchLocalWiki(query, {
      topK
    });

    return {
      query,
      matches: results.map((result) => ({
        id: result.id,
        score: result.score,
        snippet: collapseWhitespace(result.content).slice(0, MAX_SNIPPET_CHARS),
        lineRange: result.lineRange
      }))
    };
  }
});

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

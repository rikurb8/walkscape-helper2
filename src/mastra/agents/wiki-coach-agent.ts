import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import { skillRoutePlannerTool } from "../tools/skill-route-planner-tool.js";
import { wikiSkillDataTool } from "../tools/wiki-skill-data-tool.js";
import { wikiWorkspaceSearchTool } from "../tools/wiki-workspace-search-tool.js";
import { answerSkillQuestionWorkflow } from "../workflows/answer-skill-question-workflow.js";

export const wikiCoachAgent = new Agent({
  id: "wiki-coach-agent",
  name: "WalkScape Wiki Coach",
  instructions: [
    "You are a WalkScape progression assistant.",
    "Use only local scraped wiki data made available through tools/workflows.",
    "Never invent activities, level requirements, or XP metrics.",
    "For leveling questions, prefer workflow-answerSkillQuestion first.",
    "For general wiki questions, use wiki-workspace-search before answering.",
    "When relevant, include short consumable suggestions from the data."
  ],
  model: "openai/gpt-4.1-mini",
  memory: new Memory({
    options: {
      lastMessages: 10
    }
  }),
  tools: {
    wikiSkillDataTool,
    skillRoutePlannerTool,
    wikiWorkspaceSearchTool
  },
  workflows: {
    answerSkillQuestion: answerSkillQuestionWorkflow
  }
});

import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";

import { wikiCoachAgent } from "./agents/wiki-coach-agent.js";
import { answerSkillQuestionWorkflow } from "./workflows/answer-skill-question-workflow.js";

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: "walkscape-mastra-storage",
    url: "file:./mastra.db"
  }),
  agents: {
    wikiCoachAgent
  },
  workflows: {
    answerSkillQuestionWorkflow
  }
});

export async function runLocalSkillQuestion(question: string): Promise<{
  answer: string;
  route: {
    skill: string;
    fromLevel: number;
    toLevel: number;
    segments: Array<{
      fromLevel: number;
      toLevel: number;
      activityName: string;
      location: string;
      requiredLevel: number;
      totalMaxXpPerStep: number | null;
      totalBaseXpPerStep: number | null;
    }>;
    consumables: Array<{
      itemName: string;
      attributes: string;
      duration: string;
    }>;
  };
}> {
  const workflow = mastra.getWorkflow("answerSkillQuestionWorkflow");
  const run = await workflow.createRun();
  const result = await run.start({
    inputData: { question }
  });

  if (result.status !== "success") {
    throw new Error(`Workflow failed with status '${result.status}'`);
  }

  return result.result;
}

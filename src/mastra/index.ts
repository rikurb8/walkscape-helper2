import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";

import { wikiCoachAgent } from "./agents/wiki-coach-agent.js";
import { searchLocalWiki, type WikiSearchResult } from "./wiki-workspace.js";
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

export interface GuideRuntimeContext {
  username?: string;
  skillLevels?: Record<string, number>;
}

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
}>;
export async function runLocalSkillQuestion(
  question: string,
  options: { guideContext?: GuideRuntimeContext }
): Promise<{
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
}>;
export async function runLocalSkillQuestion(
  question: string,
  options?: { guideContext?: GuideRuntimeContext }
): Promise<{
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
    inputData: {
      question,
      context: options?.guideContext
    }
  });

  if (result.status !== "success") {
    const workflowError = getWorkflowErrorMessage(result);
    if (workflowError) {
      throw new Error(workflowError);
    }

    throw new Error(`Workflow failed with status '${result.status}'`);
  }

  return result.result;
}

function getWorkflowErrorMessage(
  result: { status: string } & Record<string, unknown>
): string | null {
  const error = result.error;
  if (!error) {
    return null;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return null;
}

export async function runLocalWikiQuestion(question: string): Promise<{
  answer: string;
  matches: WikiSearchResult[];
}> {
  const normalizedQuestion = question.trim();
  if (!normalizedQuestion) {
    throw new Error("Question cannot be empty");
  }

  if (isProgressionQuestion(normalizedQuestion) && hasExplicitLevelRange(normalizedQuestion)) {
    try {
      const skillResult = await runLocalSkillQuestion(normalizedQuestion);
      return {
        answer: skillResult.answer,
        matches: []
      };
    } catch {
      // Fall back to wiki search when progression parsing fails.
    }
  }

  const matches = await searchLocalWiki(normalizedQuestion, { topK: 5 });
  if (!matches.length) {
    return {
      answer: "I could not find matching local wiki content for that question.",
      matches
    };
  }

  const lines = matches.slice(0, 3).map((match, index) => {
    const title = inferTitle(match);
    const snippet = collapseWhitespace(stripFrontmatter(match.content)).slice(0, 220);
    return `${index + 1}. ${title}: ${snippet}`;
  });

  const sourceLines = matches.slice(0, 5).map((match) => `- ${match.id}`);

  return {
    answer: [
      "Based on local wiki content, these are the closest matches:",
      ...lines,
      "",
      "Sources:",
      ...sourceLines
    ].join("\n"),
    matches
  };
}

function inferTitle(result: WikiSearchResult): string {
  const firstLine = stripFrontmatter(result.content).split(/\r?\n/, 1)[0]?.trim() ?? "";
  if (firstLine.startsWith("# ")) {
    return firstLine.slice(2).trim();
  }

  return result.id;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripFrontmatter(value: string): string {
  return value.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
}

function isProgressionQuestion(question: string): boolean {
  const lower = question.toLowerCase();
  const hasSkill = SKILL_NAMES.some((skill) => lower.includes(skill));
  if (!hasSkill) {
    return false;
  }

  return /(from|to|level|lvl|route|progress|train|get\s+.+\s+to)\b/i.test(lower);
}

function hasExplicitLevelRange(question: string): boolean {
  return /(?:from\s+)?(\d+)\s*(?:to|-)\s*(\d+)/i.test(question);
}

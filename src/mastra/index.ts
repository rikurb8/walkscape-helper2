import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";

import type { AiUsageSummary } from "../cli-output.js";
import { EMPTY_AI_USAGE_SUMMARY, createAiUsageCollector } from "./ai-usage.js";
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
  ai: AiUsageSummary;
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
  ai: AiUsageSummary;
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
  ai: AiUsageSummary;
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

  const aiAnswer = await tryAnswerSkillRouteWithWikiCoach(question, result.result.route, {
    username: options?.guideContext?.username,
    skillLevels: options?.guideContext?.skillLevels
  });
  if (!aiAnswer) {
    throw new Error("AI-generated progression answer unavailable. Set OPENAI_API_KEY and retry.");
  }

  return {
    answer: aiAnswer.answer,
    ai: aiAnswer.ai,
    route: result.result.route
  };
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
  ai: AiUsageSummary;
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
        ai: skillResult.ai,
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
      ai: EMPTY_AI_USAGE_SUMMARY,
      matches
    };
  }

  const aiAnswer = await tryAnswerWithWikiCoach(normalizedQuestion, matches);
  if (!aiAnswer) {
    throw new Error("AI-generated wiki answer unavailable. Set OPENAI_API_KEY and retry.");
  }

  return {
    answer: aiAnswer.answer,
    ai: aiAnswer.ai,
    matches
  };
}

async function tryAnswerSkillRouteWithWikiCoach(
  question: string,
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
  },
  context?: GuideRuntimeContext
): Promise<{ answer: string; ai: AiUsageSummary } | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const collector = createAiUsageCollector();
  const prompt = [
    "Answer the user progression question using only the route plan below, which is derived from local wiki data.",
    "Do not invent activities, level requirements, or XP values.",
    "Keep the answer concise and practical.",
    "Use this structure:",
    "- one short intro line",
    "- a Route section with bullets for each leg",
    "- an Optional boosts section (max 5 items) if consumables exist",
    "- one short closing line",
    "",
    `Question: ${question}`,
    `Username: ${context?.username ?? "(not provided)"}`,
    `Profile skill level available: ${typeof context?.skillLevels?.[route.skill] === "number" ? context.skillLevels[route.skill] : "no"}`,
    "",
    "Route plan JSON:",
    JSON.stringify(route, null, 2)
  ].join("\n");

  try {
    const agent = mastra.getAgent("wikiCoachAgent");
    const output = await agent.generate(prompt, {
      maxSteps: 4,
      onStepFinish: (event) => {
        collector.onStepFinish(event);
      }
    });

    const answer = output.text?.trim();
    if (!answer) {
      return null;
    }

    return {
      answer,
      ai: collector.buildSummary()
    };
  } catch {
    return null;
  }
}

async function tryAnswerWithWikiCoach(
  question: string,
  matches: WikiSearchResult[]
): Promise<{ answer: string; ai: AiUsageSummary } | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const collector = createAiUsageCollector();
  const contextBlock = matches
    .slice(0, 5)
    .map((match, index) => {
      const excerpt = collapseWhitespace(stripFrontmatter(match.content)).slice(0, 700);
      return `${index + 1}. ${match.id}\n${excerpt}`;
    })
    .join("\n\n");

  const prompt = [
    "Answer the user question using only the local wiki excerpts below.",
    "If details are missing, say so instead of guessing.",
    "Include a short 'Sources:' section with bullet IDs from the excerpts.",
    "",
    `Question: ${question}`,
    "",
    "Local excerpts:",
    contextBlock
  ].join("\n");

  try {
    const agent = mastra.getAgent("wikiCoachAgent");
    const output = await agent.generate(prompt, {
      maxSteps: 4,
      onStepFinish: (event) => {
        collector.onStepFinish(event);
      }
    });

    const answer = output.text?.trim();
    if (!answer) {
      return null;
    }

    return {
      answer,
      ai: collector.buildSummary()
    };
  } catch {
    return null;
  }
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

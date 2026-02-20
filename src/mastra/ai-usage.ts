import type { AiUsageSummary } from "../cli-output.js";

type LanguageModelUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

interface UsageStepEvent {
  usage?: LanguageModelUsage;
  response?: {
    modelId?: string;
  };
  model?: {
    provider?: string;
  };
}

const MODEL_PRICING_USD_PER_MILLION: Record<string, ModelPricing> = {
  "openai/gpt-4.1": { inputPerMillion: 2, outputPerMillion: 8 },
  "openai/gpt-4.1-mini": { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  "openai/gpt-4.1-nano": { inputPerMillion: 0.1, outputPerMillion: 0.4 }
};

interface MutableModelUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
}

export const EMPTY_AI_USAGE_SUMMARY: AiUsageSummary = {
  aiUsed: false,
  models: [],
  total: {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0
  },
  currency: "USD",
  notes: []
};

export function createAiUsageCollector(): {
  onStepFinish: (event: UsageStepEvent) => void;
  addNote: (note: string) => void;
  buildSummary: () => AiUsageSummary;
} {
  const models = new Map<string, MutableModelUsage>();
  const notes = new Set<string>();

  function onStepFinish(event: UsageStepEvent): void {
    const model = inferModelName(event);
    const inputTokens = normalizeCount(event.usage?.inputTokens);
    const outputTokens = normalizeCount(event.usage?.outputTokens);
    const totalTokens = normalizeCount(event.usage?.totalTokens) || inputTokens + outputTokens;
    if (inputTokens === 0 && outputTokens === 0 && totalTokens === 0) {
      return;
    }

    const current = models.get(model) ?? {
      model,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0
    };

    current.inputTokens += inputTokens;
    current.outputTokens += outputTokens;
    current.totalTokens += totalTokens;

    const incrementalCost = estimateUsageCostUsd(model, inputTokens, outputTokens);
    if (current.estimatedCostUsd === null || incrementalCost === null) {
      current.estimatedCostUsd = null;
    } else {
      current.estimatedCostUsd += incrementalCost;
    }

    models.set(model, current);
  }

  function addNote(note: string): void {
    if (note.trim()) {
      notes.add(note.trim());
    }
  }

  function buildSummary(): AiUsageSummary {
    const modelList = Array.from(models.values()).sort((a, b) => a.model.localeCompare(b.model));
    const total = modelList.reduce(
      (acc, item) => {
        acc.inputTokens += item.inputTokens;
        acc.outputTokens += item.outputTokens;
        acc.totalTokens += item.totalTokens;
        if (acc.estimatedCostUsd === null || item.estimatedCostUsd === null) {
          acc.estimatedCostUsd = null;
        } else {
          acc.estimatedCostUsd += item.estimatedCostUsd;
        }

        return acc;
      },
      {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0 as number | null
      }
    );

    if (!modelList.length) {
      return {
        ...EMPTY_AI_USAGE_SUMMARY,
        notes: Array.from(notes)
      };
    }

    if (modelList.some((entry) => entry.estimatedCostUsd === null)) {
      notes.add("Estimated cost unavailable for one or more models.");
    }

    return {
      aiUsed: true,
      models: modelList,
      total,
      currency: "USD",
      notes: Array.from(notes)
    };
  }

  return {
    onStepFinish,
    addNote,
    buildSummary
  };
}

function normalizeCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function inferModelName(event: UsageStepEvent): string {
  const provider = typeof event.model?.provider === "string" ? event.model.provider : "";
  const modelId = typeof event.response?.modelId === "string" ? event.response.modelId : "";

  if (modelId.includes("/")) {
    return modelId;
  }

  if (provider && modelId) {
    return `${provider}/${modelId}`;
  }

  return modelId || provider || "unknown";
}

function estimateUsageCostUsd(
  modelName: string,
  inputTokens: number,
  outputTokens: number
): number | null {
  const pricing = MODEL_PRICING_USD_PER_MILLION[modelName] ?? findNormalizedPricing(modelName);
  if (!pricing) {
    return null;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  return inputCost + outputCost;
}

function findNormalizedPricing(modelName: string): ModelPricing | undefined {
  const datedModelName = modelName.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  return MODEL_PRICING_USD_PER_MILLION[datedModelName];
}

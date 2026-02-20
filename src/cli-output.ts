export interface BooleanFlagResult {
  args: string[];
  enabled: boolean;
}

export interface AiUsageModelSummary {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
}

export interface AiUsageSummary {
  aiUsed: boolean;
  models: AiUsageModelSummary[];
  total: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number | null;
  };
  currency: "USD";
  notes: string[];
}

export function stripBooleanFlag(args: string[], flag: string): BooleanFlagResult {
  const remaining: string[] = [];
  let enabled = false;

  for (const arg of args) {
    if (arg === flag) {
      enabled = true;
      continue;
    }

    remaining.push(arg);
  }

  return {
    args: remaining,
    enabled
  };
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function printCommandError(mode: string, error: unknown, asJson: boolean): void {
  const message = toErrorMessage(error);

  if (asJson) {
    process.stderr.write(
      `${JSON.stringify(
        {
          mode,
          ok: false,
          error: {
            message
          }
        },
        null,
        2
      )}\n`
    );
    return;
  }

  process.stderr.write(`${message}\n`);
}

export function printAiUsageSummary(summary: AiUsageSummary): void {
  if (!summary.aiUsed) {
    console.log("AI usage: none");
  } else {
    console.log("AI usage:");
    for (const model of summary.models) {
      const costText =
        typeof model.estimatedCostUsd === "number"
          ? `$${model.estimatedCostUsd.toFixed(6)}`
          : "n/a";
      console.log(
        `- ${model.model}: in ${model.inputTokens}, out ${model.outputTokens}, total ${model.totalTokens}, est ${costText}`
      );
    }

    const totalCostText =
      typeof summary.total.estimatedCostUsd === "number"
        ? `$${summary.total.estimatedCostUsd.toFixed(6)}`
        : "n/a";
    console.log(
      `- total: in ${summary.total.inputTokens}, out ${summary.total.outputTokens}, total ${summary.total.totalTokens}, est ${totalCostText}`
    );
  }

  for (const note of summary.notes) {
    console.log(`- note: ${note}`);
  }
}

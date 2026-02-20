export interface BooleanFlagResult {
  args: string[];
  enabled: boolean;
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

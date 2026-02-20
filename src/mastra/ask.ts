import { runLocalSkillQuestion } from "./index.js";

async function main(): Promise<void> {
  const rawQuestion = process.argv.slice(2).join(" ").trim();
  if (!rawQuestion) {
    throw new Error('Usage: pnpm ask "what should i do to get fishing from 30 to 55?"');
  }

  const result = await runLocalSkillQuestion(rawQuestion);
  console.log(result.answer);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

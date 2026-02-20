import { runLocalSkillQuestion } from "./index.js";

async function main(): Promise<void> {
  const rawQuestion = process.argv.slice(2).join(" ").trim();
  if (!rawQuestion) {
    throw new Error('Usage: pnpm ask "how to get from fishing 35 to 50?"');
  }

  const result = await runLocalSkillQuestion(rawQuestion);
  console.log(result.answer);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

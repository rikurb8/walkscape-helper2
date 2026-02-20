import { runLocalWikiQuestion } from "./index.js";

async function main(): Promise<void> {
  const rawQuestion = process.argv.slice(2).join(" ").trim();
  if (!rawQuestion) {
    throw new Error('Usage: pnpm wiki "where can i train fishing around level 50?"');
  }

  const result = await runLocalWikiQuestion(rawQuestion);
  console.log(result.answer);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

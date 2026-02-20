import { printCommandError, printJson, stripBooleanFlag } from "../cli-output.js";
import { runLocalWikiQuestion } from "./index.js";

async function main(): Promise<void> {
  const parsed = stripBooleanFlag(process.argv.slice(2), "--json");
  const rawQuestion = parsed.args.join(" ").trim();
  if (!rawQuestion) {
    throw new Error('Usage: pnpm wiki [--json] "where can i train fishing around level 50?"');
  }

  const result = await runLocalWikiQuestion(rawQuestion);

  if (parsed.enabled) {
    printJson({
      mode: "wiki",
      ok: true,
      question: rawQuestion,
      answer: result.answer,
      matches: result.matches
    });
    return;
  }

  console.log("=== WalkScape Wiki ===");
  console.log(`Question: ${rawQuestion}`);
  console.log("");
  console.log(result.answer);

  if (result.matches.length) {
    console.log("");
    console.log("Top matches:");
    for (const [index, match] of result.matches.slice(0, 5).entries()) {
      console.log(`${index + 1}. ${match.id} (score ${match.score.toFixed(3)})`);
    }
  }
}

const jsonMode = process.argv.includes("--json");

void main().catch((error: unknown) => {
  printCommandError("wiki", error, jsonMode);
  process.exitCode = 1;
});

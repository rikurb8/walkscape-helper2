import { printCommandError, printJson, stripBooleanFlag } from "../cli-output.js";
import { runLocalSkillQuestion } from "./index.js";

async function main(): Promise<void> {
  const parsed = stripBooleanFlag(process.argv.slice(2), "--json");
  const rawQuestion = parsed.args.join(" ").trim();
  if (!rawQuestion) {
    throw new Error('Usage: pnpm ask [--json] "how to get from fishing 35 to 50?"');
  }

  const result = await runLocalSkillQuestion(rawQuestion);

  if (parsed.enabled) {
    printJson({
      mode: "ask",
      ok: true,
      question: rawQuestion,
      answer: result.answer,
      route: result.route
    });
    return;
  }

  console.log("=== Skill Route Planner ===");
  console.log(`Question: ${rawQuestion}`);
  console.log("");
  console.log(result.answer);
}

const jsonMode = process.argv.includes("--json");

void main().catch((error: unknown) => {
  printCommandError("ask", error, jsonMode);
  process.exitCode = 1;
});

import { printCommandError, printJson, stripBooleanFlag } from "../cli-output.js";
import { searchLocalWiki } from "./wiki-workspace.js";

async function main(): Promise<void> {
  const parsed = stripBooleanFlag(process.argv.slice(2), "--json");
  const query = parsed.args.join(" ").trim();
  if (!query) {
    throw new Error(
      'Usage: pnpm wiki:search [--json] "where can i train fishing around level 50?"'
    );
  }

  const results = await searchLocalWiki(query, { topK: 5 });

  if (parsed.enabled) {
    printJson({
      mode: "wiki-search",
      ok: true,
      query,
      matches: results.map((result) => ({
        id: result.id,
        score: result.score,
        lineRange: result.lineRange,
        snippet: collapseWhitespace(stripFrontmatter(result.content)).slice(0, 240)
      }))
    });
    return;
  }

  console.log("=== Wiki Search ===");
  console.log(`Query: ${query}`);

  if (!results.length) {
    console.log("No matching local wiki content found.");
    return;
  }

  console.log(`Matches: ${results.length}`);

  for (const [index, result] of results.entries()) {
    const snippet = collapseWhitespace(stripFrontmatter(result.content)).slice(0, 240);
    console.log("");
    console.log(`${index + 1}. ${result.id}`);
    console.log(`   score: ${result.score.toFixed(3)}`);
    console.log(`   ${snippet}`);
  }
}

const jsonMode = process.argv.includes("--json");

void main().catch((error: unknown) => {
  printCommandError("wiki-search", error, jsonMode);
  process.exitCode = 1;
});

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripFrontmatter(value: string): string {
  return value.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
}

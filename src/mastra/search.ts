import { searchLocalWiki } from "./wiki-workspace.js";

async function main(): Promise<void> {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    throw new Error('Usage: pnpm wiki:search "where can i train fishing around level 50?"');
  }

  const results = await searchLocalWiki(query, { topK: 5 });
  if (!results.length) {
    console.log("No matching wiki content found.");
    return;
  }

  for (const [index, result] of results.entries()) {
    const snippet = collapseWhitespace(result.content).slice(0, 240);
    console.log(`${index + 1}. ${result.id} (score ${result.score.toFixed(3)})`);
    console.log(`   ${snippet}`);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

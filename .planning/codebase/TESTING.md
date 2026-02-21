# Testing Patterns

**Analysis Date:** 2026-02-21

## Test Framework

**Runner:**

- Node.js built-in test runner via `tsx --test` (script in `package.json`).
- Config: Not detected (`vitest.config.*` and `jest.config.*` are not present).

**Assertion Library:**

- `node:assert/strict` (examples in `src/mastra/guide-context.test.ts` and `src/mastra/evals/fishing-30-55.eval.test.ts`).

**Run Commands:**

```bash
pnpm test              # Run all test files matching src/**/*.test.ts
pnpm test --watch      # Watch mode (delegated to Node test runner via tsx)
pnpm test -- --test-reporter=spec  # Alternate reporter for local diagnostics
```

## Test File Organization

**Location:**

- Co-located with implementation domain code under `src/`.
- Current test files:
  - `src/mastra/guide-context.test.ts`
  - `src/mastra/evals/fishing-30-55.eval.test.ts`

**Naming:**

- Use `*.test.ts` suffix (no `*.spec.ts` files detected).

**Structure:**

```
src/
  mastra/
    guide-context.test.ts
    evals/
      fishing-30-55.eval.test.ts
```

## Test Structure

**Suite Organization:**

```typescript
import test from "node:test";
import assert from "node:assert/strict";

test("behavior description", async (t) => {
  if (!(await precondition())) {
    t.skip("requires fixture/data file");
    return;
  }

  const result = await runSubject();
  assert.equal(result.ok, true);
});
```

**Patterns:**

- Setup is inline per test using local constants and helper functions (`FISHING_PARSE_PATH`, `hasFishingData` in both test files).
- Teardown hooks are not used; tests rely on read-only inputs and pure assertions.
- Assertions use `assert.equal`, `assert.deepEqual`, `assert.match`, and `assert.rejects`.

## Mocking

**Framework:**

- Not used; no `mock`, `sinon`, or `vi/jest` mocking APIs detected.

**Patterns:**

```typescript
// Prefer real module behavior + deterministic local artifacts
const result = await runLocalSkillQuestion("what should i do to get fishing from 30 to 55?");
assert.equal(result.route.segments.length, 3);
```

**What to Mock:**

- Not established in current codebase; prefer adding pure helper extraction first if mocking becomes necessary.

**What NOT to Mock:**

- Do not mock local route-planning behavior in `src/mastra/index.ts` and `src/mastra/workflows/answer-skill-question-workflow.ts` for core correctness checks.

## Fixtures and Factories

**Test Data:**

```typescript
const parsed = parseCharacterExport(
  JSON.stringify({
    username: "riku",
    skills: { fishing: { level: 34 }, woodcutting: "18" }
  })
);
```

**Location:**

- Inline JSON fixtures inside test files for parser coverage (`src/mastra/guide-context.test.ts`).
- File-backed prerequisite fixture in repository data outputs (`data/raw/skills/fishing_parse.json`) guarded by `fs.access` checks before execution.

## Coverage

**Requirements:**

- None enforced; no coverage threshold or report configuration detected.

**View Coverage:**

```bash
Not configured in package scripts
```

## Test Types

**Unit Tests:**

- Parser and validation behavior checks with inline inputs (`parseCharacterExport` cases in `src/mastra/guide-context.test.ts`).

**Integration Tests:**

- End-to-end local flow checks across workflow + planner (`runLocalSkillQuestion` path in both test files).
- Eval pipeline assertions for scored outputs (`runFishing3055Eval` in `src/mastra/evals/fishing-30-55.eval.test.ts`).

**E2E Tests:**

- Not used (no browser or CLI process-spawn E2E framework detected).

## Common Patterns

**Async Testing:**

```typescript
test("fails clearly when current level is missing", async () => {
  await assert.rejects(
    async () => runLocalSkillQuestion("how do i get fishing to 55?"),
    /requires your current fishing level/i
  );
});
```

**Error Testing:**

```typescript
await assert.rejects(async () => subject(), /expected error message/i);
```

---

_Testing analysis: 2026-02-21_

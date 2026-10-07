#!/usr/bin/env node
/**
 * Syncs the ThreadContextScope/TrialSnapshot type definitions from
 * packages/shared-types into a local, dependency-free copy inside
 * apps/agent.
 *
 * Why this exists: apps/agent is deployed as a standalone LangGraph build
 * (langgraph.json -> dependencies: ["."]) which only ever sees the
 * apps/agent directory — it has no access to the monorepo root or to
 * packages/shared-types. So the agent can't depend on
 * @acadia/shared-types directly; instead it keeps a generated local copy
 * that's committed to git, and this script (plus the `check` mode) is
 * what keeps that copy honest.
 *
 * Usage:
 *   tsx scripts/sync-shared-types.ts          # regenerate the local copy
 *   tsx scripts/sync-shared-types.ts --check  # fail if the copy is stale (for CI)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SOURCE_PATH = resolve(__dirname, "../../../packages/shared-types/src/index.ts");
const TARGET_PATH = resolve(__dirname, "../src/types/thread-context-scope.ts");

// Only these exported type declarations are relevant to the agent; anything
// else in shared-types (e.g. TrialBookmark, which references DB/user fields
// the agent never touches) is intentionally left out.
const TYPES_TO_SYNC = ["TrialSnapshot", "ThreadContextScope"];

function extractTypeBlock(source: string, typeName: string): string {
  const startMarker = `export type ${typeName} =`;
  const startIdx = source.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error(`Could not find "export type ${typeName}" in ${SOURCE_PATH}`);
  }

  // Walk forward from the `=` to find the statement-terminating `;` that
  // closes this type, respecting nested braces so we don't cut off early.
  let i = startIdx + startMarker.length;
  let depth = 0;
  let sawNonSpace = false;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (!/\s/.test(ch)) sawNonSpace = true;
    if (ch === ";" && depth <= 0 && sawNonSpace) {
      i++;
      break;
    }
  }

  // Include any leading JSDoc comment immediately preceding the declaration.
  let leadStart = startIdx;
  const before = source.slice(0, startIdx);
  const commentMatch = before.match(/(\/\*\*[\s\S]*?\*\/\s*)$/);
  if (commentMatch) {
    leadStart = startIdx - commentMatch[1].length;
  }

  return source.slice(leadStart, i).trimEnd();
}

function generate(): string {
  if (!existsSync(SOURCE_PATH)) {
    throw new Error(`Source file not found: ${SOURCE_PATH}`);
  }
  const source = readFileSync(SOURCE_PATH, "utf8");
  const blocks = TYPES_TO_SYNC.map((name) => extractTypeBlock(source, name));

  return `/**
 * AUTO-GENERATED — do not edit by hand.
 *
 * Synced from packages/shared-types/src/index.ts via
 * \`npm run sync-shared-types --workspace=apps/agent\`.
 *
 * The agent app is built as a standalone LangGraph deployment (its
 * langgraph.json packages only this directory for builds/deploys), with
 * no access to the monorepo root or lockfile at build time. So it can't
 * depend on the @acadia/shared-types workspace package directly; this
 * generated copy is what the agent actually imports at runtime.
 *
 * If you change ThreadContextScope or TrialSnapshot in
 * packages/shared-types/src/index.ts, re-run the sync script and commit
 * the result. CI (\`npm run check-shared-types\`) fails the build if this
 * file drifts out of sync with the source.
 */

${blocks.join("\n\n")}
`;
}

function main() {
  const checkMode = process.argv.includes("--check");
  const generated = generate();

  if (checkMode) {
    const current = existsSync(TARGET_PATH) ? readFileSync(TARGET_PATH, "utf8") : null;
    if (current !== generated) {
      console.error(
        "✗ apps/agent/src/types/thread-context-scope.ts is out of sync with packages/shared-types/src/index.ts.\n" +
          "  Run `npm run sync-shared-types --workspace=apps/agent` and commit the result."
      );
      process.exit(1);
    }
    console.log("✓ thread-context-scope.ts is in sync with packages/shared-types.");
    return;
  }

  writeFileSync(TARGET_PATH, generated);
  console.log(`✓ Wrote ${TARGET_PATH}`);
}

main();

// check-cape-source
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { a01a1335488937f1c8c3983dd2950028e as checkCapeSource } from "../src/a01a1335488937f1c8c3983dd2950028e.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { repoDir } from "../scripts/source-cape.mjs";
import { tempDir } from "./harness.ts";

const ID = "01a1335b-f253-7b80-ab64-d2f9a03c9634";
const HEX = ID.replace(/-/g, "");

test("this repo accounts for every file", () => {
	assert.deepEqual(checkCapeSource(repoDir), []);
});

test("names every way a cape repo can disagree with its docs", () => {
	const dir = tempDir("check");
	for (const sub of ["kb", "src", "test"]) mkdirSync(join(dir, sub));
	writeFileSync(join(dir, "kb", `${ID}.md`), `---\nkind: action\nid: ${ID}\nname: greet\nmeta:\n  usages:\n    - wave <who>\n---\n`);
	writeFileSync(join(dir, "src", `a${HEX}.ts`), `export function a${HEX}() {}\n`);
	writeFileSync(join(dir, "src", "stray.ts"), "");
	const problems = checkCapeSource(dir).join("\n");
	assert.match(problems, /usage `wave <who>`: does not start with greet/);
	assert.match(problems, /usage `wave <who>`: missing src\/i[0-9a-f]{32}\.ts/);
	assert.match(problems, /usage `wave <who>`: missing test\/t[0-9a-f]{32}\.test\.ts/);
	assert.match(problems, /usage `wave <who>`: src\/a[0-9a-f]{32}\.ts never calls i[0-9a-f]{32}/);
	assert.match(problems, /src\/stray\.ts: no action doc accounts for it/);
});

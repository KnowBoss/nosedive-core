// check-cape-source
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335488937f1c8c3983dd2950028e as checkCapeSource } from "../src/i01a1335488937f1c8c3983dd2950028e.ts";
import { i01a133548178739398941123114401ad as usageId } from "../src/i01a133548178739398941123114401ad.ts";
import { i01a1336cb234701bb0338faf5183960c as codeSection } from "../src/i01a1336cb234701bb0338faf5183960c.ts";
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
	writeFileSync(join(dir, "src", `i${HEX}.ts`), `export function i${HEX}() {}\n`);
	writeFileSync(join(dir, "src", "stray.ts"), "");
	const problems = checkCapeSource(dir).join("\n");
	assert.match(problems, /usage `wave <who>`: starts neither with greet nor with pass --<sect> <kind>/);
	assert.match(problems, /usage `wave <who>`: missing src\/i[0-9a-f]{32}\.ts/);
	assert.match(problems, /usage `wave <who>`: missing test\/t[0-9a-f]{32}\.test\.ts/);
	assert.match(problems, /usage `wave <who>`: src\/i[0-9a-f]{32}\.ts never calls i[0-9a-f]{32}/);
	assert.match(problems, /src\/stray\.ts: no doc accounts for it/);
});

test("refuses an action without usages, and a function with any", () => {
	const dir = tempDir("check-kinds");
	for (const sub of ["kb", "src", "test"]) mkdirSync(join(dir, sub));
	writeFileSync(join(dir, "kb", `${ID}.md`), `---\nkind: action\nid: ${ID}\nname: greet\n---\n`);
	const problems = checkCapeSource(dir).join("\n");
	assert.match(problems, /greet \(kb\/[^)]+\): an action lists usages; make it a function if users cannot call it/);
	writeFileSync(join(dir, "kb", `${ID}.md`), `---\nkind: function\nid: ${ID}\nname: greet\nmeta:\n  usages:\n    - greet <who>\n---\n`);
	assert.match(checkCapeSource(dir).join("\n"), /greet \(kb\/[^)]+\): a function has no usages; make it an action if users can call it/);
});

test("an action is a gate when its usages start pass --<sect> <kind>, whose usages need an impl and no test, and never both a gate and a command", () => {
	const dir = tempDir("check-gate");
	const gate = "01a14b30-922d-7aa7-9ea9-8b0268e7ce95";
	const hex = gate.replace(/-/g, "");
	for (const sub of ["kb", "src", "test"]) mkdirSync(join(dir, sub));
	const texts = ["pass --home <repo> [--sync]", "pass home <quid>"];
	const usages = texts.map((text) => ({ id: usageId(text, gate), text }));
	const doc = { kind: "action" as const, name: "home", gist: "", usages, top: true, text: "", body: "" };
	const lines = texts.map((text) => `    - ${text}\n`).join("");
	writeFileSync(join(dir, "kb", `${gate}.md`), `---\nkind: action\nid: ${gate}\nname: home\nmeta:\n  usages:\n${lines}---\n${codeSection("\n# Home\n", doc, `i${hex}`)}`);
	writeFileSync(join(dir, "src", `i${hex}.ts`), `export function i${hex}() { return [${usages.map((usage) => `i${usage.id}`).join(", ")}]; }\n`);
	for (const usage of usages) writeFileSync(join(dir, "src", `i${usage.id}.ts`), `export function i${usage.id}() {}\n`);
	assert.deepEqual(checkCapeSource(dir), [
		"home (kb/01a14b30-922d-7aa7-9ea9-8b0268e7ce95.md): its usages start both with its name and with pass --<sect> <kind>; an action is a command or a gate",
		"home (kb/01a14b30-922d-7aa7-9ea9-8b0268e7ce95.md) usage `pass home <quid>`: starts neither with home nor with pass --<sect> <kind>",
		`home (kb/01a14b30-922d-7aa7-9ea9-8b0268e7ce95.md) usage \`pass home <quid>\`: missing test/t${usages[1]!.id}.test.ts`,
	]);
});

// describe-cape-source
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335487e477549d84a6fc2c901bf6 as describeCapeSource } from "../src/i01a1335487e477549d84a6fc2c901bf6.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { repoDir } from "../scripts/source-cape.mjs";
import { tempDir } from "./harness.ts";

const SCAF = "01a13354-7f5f-7c45-a3fb-2ac0e3a7678e";

test("describes this repo's actions, skipping docs of other kinds", () => {
	const { docs, entries } = describeCapeSource(repoDir);
	const scaf = docs[SCAF]!;
	assert.equal(scaf.name, "scaf");
	assert.deepEqual(scaf.usages[0], { id: "c984cd607bf9568d97eb5ffb0b7da854", text: "scaf [<quid>]" });
	assert.equal(scaf.top, true, "its parent is the backlog root, which is no action");
	assert.match(scaf.body, /^# Scaf\n/);
	assert.equal(docs["01a13354-7d34-72f3-ad11-9c44b4d5de6e"], undefined);
	assert.deepEqual(
		entries.find((entry) => entry.id === SCAF),
		{ id: SCAF, name: "i01a133547f5f7c45a3fb2ac0e3a7678e", file: join(repoDir, "src", "i01a133547f5f7c45a3fb2ac0e3a7678e.ts") },
	);
});

test("an action under another action is not top-level", () => {
	const dir = tempDir("describe-nested");
	mkdirSync(join(dir, "kb"));
	const parent = "01a1335b-f253-7b80-ab64-d2f9a03c9634";
	const child = "01a1335b-f30a-7dd2-a1d4-b675fd419238";
	writeFileSync(join(dir, "kb", `${parent}.md`), `---\nkind: action\nid: ${parent}\nname: tool\n---\n`);
	writeFileSync(
		join(dir, "kb", `${child}.md`),
		`---\nkind: action\nid: ${child}\nname: sub.tool\nlinks:\n  - kb/${parent}.md:\n      rel: parent.feat\n---\n`,
	);
	const { docs } = describeCapeSource(dir);
	assert.deepEqual([docs[parent]!.top, docs[child]!.top], [true, false]);
});

// find-root
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a13a6aba3a763595bd67a4ee4d47bf as findRoot } from "./i01a13a6aba3a763595bd67a4ee4d47bf.ts";
import { CANONICAL, checkedOut, gitRepo, tempBridge } from "../test/harness.ts";

const ROOT = "01a1335b-f253-7b80-ab64-d2f9a03c9634";

test("reads the first root the config lists, and its kind", async () => {
	const dir = gitRepo("find-root-first");
	mkdirSync(join(dir, ".nosedive"));
	mkdirSync(join(dir, "kb"));
	writeFileSync(join(dir, ".nosedive", "config.yaml"), `roots:\n  - kb/${ROOT}.md\n`);
	writeFileSync(join(dir, "kb", `${ROOT}.md`), `---\nkind: cape\nid: ${ROOT}\n${CANONICAL}---\n`);
	assert.equal(findRoot(dir)?.kind, "cape");
	writeFileSync(join(dir, "kb", `${ROOT}.md`), `---\nkind: cape\nid: ${ROOT}\n---\n`);
	assert.equal(findRoot(dir)?.kind, `${ROOT}:cape`, "a cape kind of its own repo's is not core's");
	assert.equal(findRoot(dir, "cape"), undefined);
});

test("finds nothing for a repo that is no bridge, even inside a bridge's workspace", async () => {
	const bridge = await tempBridge("find-root-none");
	assert.equal(findRoot(checkedOut(bridge, "plain")), undefined);
	assert.equal(findRoot(bridge)?.kind, "base", "a hero's root is a base");
});

test("given a kind, finds the first root of that kind among the roots config lists", () => {
	const dir = gitRepo("find-root-kind");
	const other = "01a1335b-f253-7b80-ab64-d2f9a03c9635";
	mkdirSync(join(dir, ".nosedive"));
	mkdirSync(join(dir, "kb"));
	mkdirSync(join(dir, "actions"));
	writeFileSync(join(dir, ".nosedive", "config.yaml"), `id: ${ROOT}\nroots:\n  - kb/${ROOT}.md\n  - actions/${other}.md\n`);
	writeFileSync(join(dir, "kb", `${ROOT}.md`), `---\nkind: root\nid: ${ROOT}\n${CANONICAL}---\n`);
	writeFileSync(join(dir, "actions", `${other}.md`), `---\nkind: cape\nid: ${other}\n${CANONICAL}---\n`);
	assert.equal(findRoot(dir)?.kind, "root");
	assert.equal(findRoot(dir, "cape")?.fm.id, other);
	assert.equal(findRoot(dir, "memo"), undefined);
});

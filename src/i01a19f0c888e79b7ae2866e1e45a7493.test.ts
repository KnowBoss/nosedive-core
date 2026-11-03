// durable-from-done-when
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a19f0c888e79b7ae2866e1e45a7493 as durableFromDoneWhen, UNSAID_DONE_WHEN } from "./i01a19f0c888e79b7ae2866e1e45a7493.ts";
import { doneWhenOf } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { CANONICAL, gitRepo } from "../test/harness.ts";

const core: Cape = await sourceCape();
const ROOT = "01a19f0c-0000-7000-8000-000000000001";
const id = (n: number) => `01a19f0c-0000-7000-8000-${String(n).padStart(12, "0")}`;

function repo(label: string) {
	const dir = gitRepo(label);
	mkdirSync(join(dir, ".nosedive", "kinds"), { recursive: true });
	mkdirSync(join(dir, "kb"));
	writeFileSync(join(dir, "kb", `${ROOT}.md`), `---\nkind: base\nid: ${ROOT}\n${CANONICAL}---\n\n# Root\n`);
	writeFileSync(join(dir, ".nosedive", "config.yaml"), `id: ${ROOT}\nroots:\n  - kb/${ROOT}.md\n`);
	return dir;
}

function kindDoc(dir: string, n: number, name: string, meta: string, body = "", where = ".nosedive/kinds", scopes = ""): string {
	const path = join(dir, where, `${id(n)}.md`);
	writeFileSync(path, `---\nkind: kind\nid: ${id(n)}\nname: ${name}\n${scopes}meta:\n  schema:\n    type: object\n${meta}---\n\n# ${name}\n\nWhat it is.\n${body}`);
	return path;
}

const fm = (path: string) => parse(/^---\n([\s\S]*?)---\n/.exec(readFileSync(path, "utf8"))![1]!) as { meta: Record<string, unknown> };
const quiet = () => {
	const said: string[] = [];
	return { said, ctx: { capes: [core], out: (line: string) => said.push(line) } };
};

test("drops meta.durable, keeping each kind as durable as it was, and gives a Done when to one that was not durable and had none", () => {
	const dir = repo("durable-from-done-when");
	const keep = kindDoc(dir, 2, "keep", "  durable: true\n");
	const memo = kindDoc(dir, 3, "memo", "  durable: false\n", "\n## Done when\n\nIt is settled.\n");
	const step = kindDoc(dir, 4, "step", "  durable: false\n  next:\n    - open.spec\n", "\n## Later\n\nKept as it is.\n");
	const plain = kindDoc(dir, 5, "plain", "");
	const legacy = kindDoc(dir, 6, "legacy", "  durable: false\n", "", "kb", CANONICAL);
	const note = join(dir, "kb", `${id(7)}.md`);
	writeFileSync(note, `---\nkind: note\nid: ${id(7)}\nmeta:\n  durable: false\n---\n\n# A note\n`);
	const plainBefore = readFileSync(plain, "utf8");
	const noteBefore = readFileSync(note, "utf8");

	const { said, ctx } = quiet();
	assert.deepEqual(new Set(durableFromDoneWhen(dir, ctx)), new Set([keep, memo, step, legacy]));
	for (const path of [keep, memo, step, legacy]) assert.equal("durable" in fm(path).meta, false, path);
	assert.deepEqual(fm(step).meta.next, ["open.spec"], "the rest of its meta is kept");
	assert.equal(doneWhenOf(readFileSync(keep, "utf8")), undefined, "keep stays durable");
	assert.equal(doneWhenOf(readFileSync(memo, "utf8")), "It is settled.", "memo's own Done when is kept");
	assert.equal(doneWhenOf(readFileSync(step, "utf8")), UNSAID_DONE_WHEN, "step stays passing work");
	assert.match(readFileSync(step, "utf8"), /## Later\n\nKept as it is\.\n\n## Done when\n\nNot yet said: ask the pilot\.\n$/, "appended after the rest of its body");
	assert.equal(doneWhenOf(readFileSync(legacy, "utf8")), UNSAID_DONE_WHEN, "a kind doc of core's in a root's kb too");
	assert.equal(readFileSync(plain, "utf8"), plainBefore, "a kind doc without the flag is left as it is");
	assert.equal(readFileSync(note, "utf8"), noteBefore, "a doc of another kind is not a kind doc");
	assert.match(said.join("\n"), /kind keep stays durable, having no Done when/);
	assert.match(said.join("\n"), /kind step stays passing work, given a Done when for the pilot to fill in/);

	const again = quiet();
	assert.deepEqual(durableFromDoneWhen(dir, again.ctx), [], "a migrated repo is left as it is");
	assert.deepEqual(again.said, []);
});

test("waits, writing nothing, while a kind doc says durable: true and has a Done when", () => {
	const dir = repo("durable-from-done-when-clash");
	const clash = kindDoc(dir, 2, "clash", "  durable: true\n", "\n## Done when\n\nIt is over.\n");
	const step = kindDoc(dir, 3, "step", "  durable: false\n");
	const before = [readFileSync(clash, "utf8"), readFileSync(step, "utf8")];
	const { said, ctx } = quiet();
	assert.equal(durableFromDoneWhen(dir, ctx), undefined);
	assert.deepEqual([readFileSync(clash, "utf8"), readFileSync(step, "utf8")], before);
	assert.match(said.join("\n"), /kind clash \(.*\) says durable: true and has a Done when section; drop the section to keep it durable, or meta\.durable to make it passing work, then seed/);
});

test("has nothing to do in a repo with no config", () => {
	assert.deepEqual(durableFromDoneWhen(gitRepo("durable-from-done-when-bare"), quiet().ctx), []);
});

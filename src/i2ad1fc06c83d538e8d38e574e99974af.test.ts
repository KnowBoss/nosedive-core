// crud --batch <source>
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { declareKinds, git, ok, run, tempBridge, kbOf } from "../test/harness.ts";

const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");

test("CRUD enforces reference kinds on create and edit, and batch uses final target kinds atomically", async () => {
	const bridge = await tempBridge("crud-reference-kind");
	await declareKinds(bridge, "goal");
	ok(await run(["crud", "core:kind", "inquiry", "--name", "inquiry", "--meta", "-"], bridge, "schema: {type: object, additionalProperties: true}\n"));
	ok(await run(["crud", "core:kind", "resolution", "--name", "resolution", "--meta", "-"], bridge,
		"schema:\n  type: object\n  additionalProperties: false\n  required: [question]\n  properties:\n    question: {type: string, kind: inquiry}\n"));
	const q = idOf(ok(await run(["crud", "inquiry", "which"], bridge)));
	const meta = `question: ${q}\n`;
	const d = idOf(ok(await run(["crud", "resolution", "answer", "--meta", "-"], bridge, meta)));
	const head = git(["rev-parse", "HEAD"], bridge);
	const before = readFileSync(join(kbOf(bridge), `${d}.md`), "utf8");
	assert.match((await run(["crud", "resolution", "bad", "--meta", "-"], bridge, `question: ${d}\n`)).err, /\/question must resolve/);
	assert.match((await run(["crud", d, "--meta", "-"], bridge, "question: absent\n")).err, /\/question must resolve/);
	// The target changes after the referencing doc is edited; validation must see its final kind.
	const refused = await run(["crud", "--batch", "-"], bridge,
		`- quid: ${d}\n  meta: {question: ${q}}\n- quid: ${q}\n  kind: goal\n`);
	assert.match(refused.err, /\/question must resolve/);
	assert.equal(git(["rev-parse", "HEAD"], bridge), head);
	assert.equal(readFileSync(join(kbOf(bridge), `${d}.md`), "utf8"), before);
	assert.match(readFileSync(join(kbOf(bridge), `${q}.md`), "utf8"), /kind: inquiry/);
	// Conversely, a target becoming the correct kind in this batch is accepted.
	const next = idOf(ok(await run(["crud", "goal", "next question"], bridge)));
	ok(await run(["crud", "--batch", "-"], bridge,
		`- quid: ${d}\n  meta: {question: ${next}}\n- quid: ${next}\n  kind: inquiry\n`));
});

test("applies every edit in order and commits once, with text inline", async () => {
	const bridge = await tempBridge("crud-batch");
	await declareKinds(bridge, "goal");
	const a = ok(await run(["crud", "goal", "a"], bridge));
	const b = ok(await run(["crud", "goal", "b"], bridge));
	const head = git(["rev-parse", "HEAD"], bridge);
	const batch = [
		`- quid: ${idOf(a)}`,
		"  title: Alpha",
		`- quid: ${idOf(a)}`,
		"  body: |",
		"    A path: C:\\old\\dir",
		"",
		"    Done.",
		`- quid: ${idOf(a)}`,
		"  section: {heading: Open, text: Nothing yet.}",
		`- quid: ${idOf(a)}`,
		"  replace:",
		"    old: C:\\old\\dir",
		"    new: D:\\new\\dir",
		`- quid: ${idOf(b)}`,
		"  gist: second",
		`- quid: ${idOf(b)}`,
		`  parent: ${idOf(a)}`,
		`- quid: ${idOf(b)}`,
		"  meta: {size: 2}",
		"",
	].join("\n");

	assert.deepEqual(ok(await run(["crud", "--batch", "-"], bridge, batch)).split("\n").sort(), [a, b].sort());
	assert.equal(git(["log", "--format=%s", `${head}..HEAD`], bridge), "crud: title, body, section, replace, gist, parent, meta");
	assert.match(readFileSync(join(bridge, a), "utf8"), /\n---\n\n# Alpha\n\nA path: D:\\new\\dir\n\nDone\.\n\n## Open\n\nNothing yet\.\n$/);
	assert.match(readFileSync(join(bridge, a), "utf8"), new RegExp(`- kb/${idOf(b)}\\.md:\n {6}rel: child\\.feat\n`));
	const second = readFileSync(join(bridge, b), "utf8");
	assert.match(second, /\ngist: "second"\n/);
	assert.match(second, /\nmeta:\n {2}size: 2\n/);
	assert.match(second, new RegExp(`- kb/${idOf(a)}\\.md:\n {6}rel: parent\\.feat\n`));
});

test("writes nothing when any edit is refused, naming the item", async () => {
	const bridge = await tempBridge("crud-batch-refused");
	await declareKinds(bridge, "goal");
	const a = ok(await run(["crud", "goal", "a"], bridge));
	const before = readFileSync(join(bridge, a), "utf8");
	const head = git(["rev-parse", "HEAD"], bridge);

	const refused = await run(["crud", "--batch", "-"], bridge, `- quid: ${idOf(a)}\n  gist: fine\n- quid: ${idOf(a)}\n  replace: {old: absent, new: x}\n`);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /--batch item 2: --replace found its text nowhere/);

	const malformed = await run(["crud", "--batch", "-"], bridge, `- quid: ${idOf(a)}\n  gist: one\n  name: two\n`);
	assert.match(malformed.err, /--batch item 1 takes a quid and one edit/);
	const unknown = await run(["crud", "--batch", "-"], bridge, `- quid: ${idOf(a)}\n  size: 2\n`);
	assert.match(unknown.err, /--batch item 1: no crud edit size: the edits are meta, scopes, links, parent, title, body, section, replace, gist, name, kind/);
	assert.match((await run(["crud", "--batch", "-"], bridge, "gist: one\n")).err, /--batch takes a list of edits/);

	assert.equal(readFileSync(join(bridge, a), "utf8"), before);
	assert.equal(git(["rev-parse", "HEAD"], bridge), head);
});

test("checks a doc's meta once, against its final kind, so kind and meta change together", async () => {
	const bridge = await tempBridge("crud-batch-kinds");
	await declareKinds(bridge, "goal");
	for (const [name, answer] of [["question", ""], ["decision", "\n    answer: { type: string }"]]) {
		const schema = `schema:\n  type: object\n  additionalProperties: false\n  required: [options${answer ? ", answer" : ""}]\n  properties:\n    options: { type: array }${answer}\n`;
		ok(await run(["crud", "core:kind", name!, "--name", name!, "--meta", "-"], bridge, schema));
	}
	const q = idOf(ok(await run(["crud", "question", "which", "--meta", "-"], bridge, "options: [a, b]\n")));
	const out = await run(["crud", "--batch", "-"], bridge, `- quid: ${q}\n  kind: decision\n- quid: ${q}\n  meta: { answer: a }\n`);
	assert.equal(out.code, 0, out.err);
	assert.match(readFileSync(join(kbOf(bridge), `${q}.md`), "utf8"), /^---\nkind: decision\n[^]*\n {2}answer: a\n/);
	const refused = await run(["crud", "--batch", "-"], bridge, `- quid: ${q}\n  kind: question\n`);
	assert.match(refused.err, new RegExp(`--batch ${q}: meta does not fit kind question`));
});

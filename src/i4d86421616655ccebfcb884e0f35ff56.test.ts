// crud --drop-list <source> [--hard]
import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { declareDurable, declareKinds, git, ok, run, tempBridge, kbOf, kbPath } from "../test/harness.ts";

const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");

test("drops docs that mention each other together, in one commit", async () => {
	const bridge = await tempBridge("crud-drop-list");
	await declareKinds(bridge, "goal");
	const a = ok(await run(["crud", "goal", "a"], bridge));
	const b = ok(await run(["crud", "goal", "b"], bridge));
	ok(await run(["crud", idOf(b), "--links", "-"], bridge, `${kbPath(bridge, idOf(a))}:\n  rel: parent.feat\n`));
	ok(await run(["crud", idOf(a), "--body", "-"], bridge, `Its child is [b](${idOf(b)}.md).\n`));
	assert.equal((await run(["crud", "--drop", idOf(a)], bridge)).code, 1, "alone, a is mentioned by b's link");

	writeFileSync(join(bridge, "drop.txt"), `${idOf(a)}\n\n${idOf(b).toUpperCase()}\n`);
	assert.equal(ok(await run(["crud", "--drop-list", "drop.txt"], bridge)), `${a}\n${b}`);
	assert.equal(existsSync(join(bridge, a)) || existsSync(join(bridge, b)), false);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), "crud: drop");
});

test("refuses while a doc outside the list links in, or one is durable, and drops nothing", async () => {
	const bridge = await tempBridge("crud-drop-list-refused");
	await declareKinds(bridge, "goal");
	await declareDurable(bridge, "keep");
	const a = idOf(ok(await run(["crud", "goal", "a"], bridge)));
	const note = idOf(ok(await run(["crud", "keep", "note"], bridge)));
	const outside = ok(await run(["crud", "goal", "outside"], bridge));
	ok(await run(["crud", idOf(outside), "--links", "-"], bridge, `${kbPath(bridge, a)}:\n  rel: uses.goal\n`));
	const head = git(["rev-parse", "HEAD"], bridge);

	const linked = await run(["crud", "--drop-list", "-"], bridge, `${a}\n${note}\n`);
	assert.equal(linked.code, 1);
	assert.match(linked.err, new RegExp(`docs outside the list still link to these, so none was dropped:\n {2}goal a-\\w{6}: ${outside} links it as uses\\.goal`));

	ok(await run(["crud", idOf(outside), "--links", "-"], bridge, `${kbPath(bridge, a)}: null\n`));
	const durable = await run(["crud", "--drop-list", "-"], bridge, `${a}\n${note}\n`);
	assert.match(durable.err, /1 of these are durable, so none was dropped; --hard drops them anyway:\n {2}keep note-\w{6}/);
	assert.equal(git(["rev-list", "--count", `${head}..HEAD`], bridge), "1", "only the unlink was committed");
	ok(await run(["crud", "--drop-list", "-", "--hard"], bridge, `${a}\n${note}\n`));
});

test("refuses a line that is not a quid", async () => {
	const bridge = await tempBridge("crud-drop-list-bad");
	await declareKinds(bridge, "goal");
	const result = await run(["crud", "--drop-list", "-"], bridge, "not-a-quid\n");
	assert.match(result.err, /--drop-list takes one quid per line, not: not-a-quid/);
});

test("ignores mentions in docs git does not track", async () => {
	const bridge = await tempBridge("crud-drop-list-untracked");
	await declareKinds(bridge, "goal");
	const a = idOf(ok(await run(["crud", "goal", "a"], bridge)));
	writeFileSync(join(kbOf(bridge), "01a14a48-61cd-7c88-a0e1-b700d01901ed.md"), `---\nkind: memo\nid: 01a14a48-61cd-7c88-a0e1-b700d01901ed\nname: copy\n---\n\nSee ${a}.\n`);
	ok(await run(["crud", "--drop-list", "-"], bridge, `${a}\n`));
});

// crud --drop-list <source> [--hard]
import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { git, ok, run, tempBridge } from "./harness.ts";

const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");

test("drops docs that mention each other together, in one commit", async () => {
	const bridge = await tempBridge("crud-drop-list");
	const a = ok(await run(["crud", "goal", "a"], bridge));
	const b = ok(await run(["crud", "goal", "b"], bridge));
	ok(await run(["crud", idOf(b), "--links", "-"], bridge, `kb/${idOf(a)}.md:\n  rel: parent.feat\n`));
	ok(await run(["crud", idOf(a), "--body", "-"], bridge, `Its child is [b](${idOf(b)}.md).\n`));
	assert.equal((await run(["crud", "--drop", idOf(a)], bridge)).code, 1, "alone, a is mentioned by b's link");

	writeFileSync(join(bridge, "drop.txt"), `${idOf(a)}\n\n${idOf(b).toUpperCase()}\n`);
	assert.equal(ok(await run(["crud", "--drop-list", "drop.txt"], bridge)), `${a}\n${b}`);
	assert.equal(existsSync(join(bridge, a)) || existsSync(join(bridge, b)), false);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), "crud: dropped 2 docs");
});

test("refuses while a doc outside the list links in, or one is durable, and drops nothing", async () => {
	const bridge = await tempBridge("crud-drop-list-refused");
	const a = idOf(ok(await run(["crud", "goal", "a"], bridge)));
	const note = idOf(ok(await run(["crud", "memo", "note"], bridge)));
	const outside = ok(await run(["crud", "goal", "outside"], bridge));
	ok(await run(["crud", idOf(outside), "--links", "-"], bridge, `kb/${a}.md:\n  rel: uses.goal\n`));
	const head = git(["rev-parse", "HEAD"], bridge);

	const linked = await run(["crud", "--drop-list", "-"], bridge, `${a}\n${note}\n`);
	assert.equal(linked.code, 1);
	assert.match(linked.err, new RegExp(`docs outside the list still link to these, so none was dropped:\n {2}goal a-\\w{6}: ${outside} links it as uses\\.goal`));

	ok(await run(["crud", idOf(outside), "--links", "-"], bridge, `kb/${a}.md: null\n`));
	const durable = await run(["crud", "--drop-list", "-"], bridge, `${a}\n${note}\n`);
	assert.match(durable.err, /1 of these are durable, so none was dropped; --hard drops them anyway:\n {2}memo note-\w{6}/);
	assert.equal(git(["rev-list", "--count", `${head}..HEAD`], bridge), "1", "only the unlink was committed");
	ok(await run(["crud", "--drop-list", "-", "--hard"], bridge, `${a}\n${note}\n`));
});

test("refuses a line that is not a quid", async () => {
	const bridge = await tempBridge("crud-drop-list-bad");
	const result = await run(["crud", "--drop-list", "-"], bridge, "not-a-quid\n");
	assert.match(result.err, /--drop-list takes one quid per line, not: not-a-quid/);
});

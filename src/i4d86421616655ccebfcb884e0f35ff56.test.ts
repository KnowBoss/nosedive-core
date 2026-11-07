// crud --drop-list <source> [--hard]
import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { declareDurable, declareKinds, git, ok, run, tempBridge, kbOf, kbPath } from "../test/harness.ts";

const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");

test("drops a doc with the child under it together, in one commit, the child's record being its parent's going", async () => {
	const bridge = await tempBridge("crud-drop-list");
	await declareKinds(bridge, "goal");
	const holder = ok(await run(["crud", "goal", "holder"], bridge));
	const a = ok(await run(["crud", "goal", "a"], bridge));
	const b = ok(await run(["crud", "goal", "b"], bridge));
	ok(await run(["crud", idOf(holder), "--links", "-"], bridge, `${kbPath(bridge, idOf(a))}:\n  rel: child.feat\n`));
	ok(await run(["crud", idOf(b), "--links", "-"], bridge, `${kbPath(bridge, idOf(a))}:\n  rel: parent.feat\n`));
	ok(await run(["crud", idOf(holder), `--section:Dropped.${idOf(a)}`, "-"], bridge, "It and its child b were tried and set aside.\n"));
	assert.match((await run(["crud", "--drop", idOf(a)], bridge)).err, /hangs under it: drop it first/, "alone, a has b under it");

	writeFileSync(join(bridge, "drop.txt"), `${idOf(a)}\n\n${idOf(b).toUpperCase()}\n`);
	assert.equal(ok(await run(["crud", "--drop-list", "drop.txt"], bridge)), `${a}\n${b}`);
	assert.equal(existsSync(join(bridge, a)) || existsSync(join(bridge, b)), false);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), "crud: drop");
	assert.doesNotMatch(git(["show", "--name-only", "--format=", "HEAD"], bridge), /drop\.txt/);
	assert.match(git(["show", "HEAD", "--", holder], bridge), /-\s+rel: child\.feat/, "the holder's link goes in the same commit");
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

	const linked = await run(["crud", "--drop-list", "-", "--sure"], bridge, `${a}\n${note}\n`);
	assert.equal(linked.code, 1);
	assert.match(linked.err, new RegExp(`none of these was dropped:\n {2}goal a-\\w{6}: ${outside} links it as uses\\.goal: remove that link first`));
	assert.match((await run(["crud", "--drop-list", "-"], bridge, `${a}\n`)).err, /it hangs from no doc/, "none hangs from a doc");

	ok(await run(["crud", idOf(outside), "--links", "-"], bridge, `${kbPath(bridge, a)}: null\n`));
	const durable = await run(["crud", "--drop-list", "-", "--sure"], bridge, `${a}\n${note}\n`);
	assert.match(durable.err, /1 of these are durable, so none was dropped; --hard drops them anyway:\n {2}keep note-\w{6}/);
	assert.equal(git(["rev-list", "--count", `${head}..HEAD`], bridge), "1", "only the unlink was committed");
	ok(await run(["crud", "--drop-list", "-", "--sure", "--hard"], bridge, `${a}\n${note}\n`));
});

test("refuses a line that is not a quid", async () => {
	const bridge = await tempBridge("crud-drop-list-bad");
	await declareKinds(bridge, "goal");
	const result = await run(["crud", "--drop-list", "-"], bridge, "not-a-quid\n");
	assert.match(result.err, /--drop-list takes one quid per line, not: not-a-quid/);
});

test("ignores links in docs git does not track", async () => {
	const bridge = await tempBridge("crud-drop-list-untracked");
	await declareKinds(bridge, "goal");
	const a = idOf(ok(await run(["crud", "goal", "a"], bridge)));
	writeFileSync(join(kbOf(bridge), "01a14a48-61cd-7c88-a0e1-b700d01901ed.md"), `---\nkind: memo\nid: 01a14a48-61cd-7c88-a0e1-b700d01901ed\nname: copy\n---\n\nSee [a](${a}.md).\n`);
	ok(await run(["crud", "--drop-list", "-", "--sure"], bridge, `${a}\n`));
});

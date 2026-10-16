// crud --drop <quid> [--hard]
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { checkedOut, git, ok, run, tempBridge } from "./harness.ts";

const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");

test("deletes a doc of a kind that is not durable, and commits", async () => {
	const bridge = await tempBridge("crud-drop");
	const path = ok(await run(["crud", "goal", "passing", "work"], bridge));
	const id = idOf(path);
	assert.equal(ok(await run(["crud", "--drop", id], bridge)), path);
	assert.equal(existsSync(join(bridge, path)), false);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), `crud(${id}): dropped goal passing-work-${id.slice(-6)}`);
	assert.equal(git(["status", "--porcelain"], bridge), "");
});

test("refuses while anything links to it, naming each link, and edits nothing", async () => {
	const bridge = await tempBridge("crud-drop-linked");
	const id = idOf(ok(await run(["crud", "goal", "parent"], bridge)));
	const child = ok(await run(["crud", "goal", "child"], bridge));
	ok(await run(["crud", idOf(child), "--links", "-"], bridge, `kb/${id}.md:\n  rel: parent.feat\n`));
	const there = ok(await run(["crud", "other:goal", "elsewhere"], (checkedOut(bridge, "other"), bridge)));
	ok(await run(["crud", idOf(there), "--links", "-"], bridge, `kb/${id}.md:\n  rel: uses.goal\n`));

	const head = git(["rev-parse", "HEAD"], bridge);
	const refused = await run(["crud", "--drop", id], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /goal parent-\w{6} is still linked, so it was not dropped:/);
	assert.match(refused.err, new RegExp(`\n {2}${child} links it as parent\\.feat`));
	assert.match(refused.err, new RegExp(`\n {2}${there} links it as uses\\.goal`));
	assert.equal(git(["rev-parse", "HEAD"], bridge), head);
});

test("refuses the root a config names", async () => {
	const bridge = await tempBridge("crud-drop-root");
	const root = /root: (\S+)/.exec(git(["show", "HEAD:.nosedive/config.yaml"], bridge))![1]!;
	const refused = await run(["crud", "--drop", root, "--hard"], bridge);
	assert.match(refused.err, /\.nosedive\/config\.yaml names it as its root/);
});

test("keeps a durable doc unless --hard", async () => {
	const bridge = await tempBridge("crud-drop-durable");
	const path = ok(await run(["crud", "memo", "a", "note"], bridge));
	const refused = await run(["crud", "--drop", idOf(path)], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /memo a-note-\w{6} is durable: its file keeps it findable by id, so it was not dropped; --hard drops it anyway/);
	assert.equal(existsSync(join(bridge, path)), true);
	ok(await run(["crud", "--drop", idOf(path), "--hard"], bridge));
	assert.equal(existsSync(join(bridge, path)), false);
});

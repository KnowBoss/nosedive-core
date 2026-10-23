// crud <quid> --meta <source>
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { checkedOut, git, ok, run, tempBridge, kbOf } from "../test/harness.ts";

test("merge-patches meta from stdin or a file, changing only that field, and commits", async () => {
	const bridge = await tempBridge("crud-meta");
	const path = ok(await run(["crud", "memo", "metered"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	const before = readFileSync(join(bridge, path), "utf8");

	ok(await run(["crud", id, "--meta", "-"], bridge, "owner: dan\nstate: open\n"));
	writeFileSync(join(bridge, "patch.yaml"), "state: null\n");
	ok(await run(["crud", id, "--meta=patch.yaml"], bridge));

	const after = readFileSync(join(bridge, path), "utf8");
	assert.equal(after, before.replace("---\n\n#", "meta:\n  owner: dan\n---\n\n#"));
	assert.equal(git(["log", "-1", "--format=%s"], bridge), `crud(${id}): updated memo metered-${id.slice(-6)}`);
});

test("removes meta when the patch empties it", async () => {
	const bridge = await tempBridge("crud-meta-empty");
	const path = ok(await run(["crud", "memo", "brief"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	ok(await run(["crud", id, "--meta", "-"], bridge, "a: 1\n"));
	ok(await run(["crud", id, "--meta", "-"], bridge, "a: null\n"));
	assert.doesNotMatch(readFileSync(join(bridge, path), "utf8"), /meta/);
});

test("refuses a patch that is not a mapping", async () => {
	const bridge = await tempBridge("crud-meta-bad");
	const id = ok(await run(["crud", "memo", "x"], bridge)).replace(/^.*\/|\.md$/g, "");
	const result = await run(["crud", id, "--meta", "-"], bridge, "- a\n");
	assert.equal(result.code, 1);
	assert.match(result.err, /--meta takes a mapping/);
});

test("refuses meta its kind's schema forbids, and edits docs in workspace repos", async () => {
	const bridge = await tempBridge("crud-meta-kinds");
	writeFileSync(
		join(kbOf(bridge), "task-kind.md"),
		"---\nkind: kind\nid: k\nname: task\nmeta:\n  schema:\n    type: object\n    additionalProperties: false\n    properties:\n      owner: {type: string}\n---\n",
	);
	const id = ok(await run(["crud", "task", "a", "task"], bridge)).replace(/^.*\/|\.md$/g, "");
	const refused = await run(["crud", id, "--meta", "-"], bridge, "bogus: 1\n");
	assert.equal(refused.code, 1);
	assert.match(refused.err, /meta does not fit kind task:\n {2}meta must NOT have additional properties/);
	ok(await run(["crud", id, "--meta", "-"], bridge, "owner: dan\n"));

	const repo = checkedOut(bridge, "other");
	const there = ok(await run(["crud", "other:memo", "over", "there"], bridge));
	const thereId = there.replace(/^.*\/|\.md$/g, "");
	assert.equal(ok(await run(["crud", thereId, "--meta", "-"], bridge, "a: 1\n")), there);
	assert.match(readFileSync(join(bridge, there), "utf8"), /\nmeta:\n {2}a: 1\n/);
	assert.match(git(["log", "-1", "--format=%s"], repo), /^crud\(\S+\): updated memo /);
});

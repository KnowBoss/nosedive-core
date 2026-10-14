// crud <quid>
import assert from "node:assert/strict";
import { test } from "node:test";
import { ok, run, tempBridge, tempDir } from "./harness.ts";

test("prints a doc from the bridge's kb", async () => {
	const bridge = await tempBridge("crud-read");
	const path = ok(await run(["crud", "memo", "read", "me"], bridge));
	const id = path.replace(/^kb\/|\.md$/g, "");
	const text = ok(await run(["crud", id], bridge));
	assert.match(text, new RegExp(`^---\\nkind: memo\\nid: ${id}\\n`));
	assert.match(text, /# read me$/);
});

test("prints a loaded cape's own action doc, with no bridge at all", async () => {
	const text = ok(await run(["crud", "01a13354-7dea-7604-b903-b94a5aca2b83"], tempDir("crud-read-cape")));
	assert.match(text, /^---\nkind: action\nid: 01a13354-7dea-7604-b903-b94a5aca2b83\nname: crud\n/);
});

test("says where it looked when the doc is nowhere", async () => {
	const result = await run(["crud", "01a1335b-f3bd-7ef4-9eb1-98115e3ba276"], await tempBridge("crud-read-missing"));
	assert.equal(result.code, 1);
	assert.match(result.err, /no doc 01a1335b-f3bd-7ef4-9eb1-98115e3ba276 in this bridge, its workspace or the loaded capes/);
});

test("refuses what is not a quid", async () => {
	const result = await run(["crud", "nope"], tempDir("crud-read-bad"));
	assert.equal(result.code, 1);
	assert.match(result.err, /not a quid: nope/);
});

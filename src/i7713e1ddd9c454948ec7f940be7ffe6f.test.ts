// crud <quid> --gist <gist>
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { git, ok, run, tempBridge } from "../test/harness.ts";

test("replaces the gist, and commits", async () => {
	const bridge = await tempBridge("crud-gist");
	const path = ok(await run(["crud", "memo", "old", "gist"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	ok(await run(["crud", id, "--gist", "A new gist: with a colon"], bridge));
	assert.match(readFileSync(join(bridge, path), "utf8"), /\ngist: "A new gist: with a colon"\n/);
	assert.match(git(["log", "-1", "--format=%s"], bridge), new RegExp(`^crud\\(${id}\\): updated memo `));
	assert.equal((await run(["crud", id, "--gist", " "], bridge)).code, 1);
});

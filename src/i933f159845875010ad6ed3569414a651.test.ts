// crud <quid> --title <title>
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { git, ok, run, tempBridge } from "../test/harness.ts";

test("replaces the title, keeping everything under it, and commits", async () => {
	const bridge = await tempBridge("crud-title");
	const path = ok(await run(["crud", "core:memo", "a", "note"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	ok(await run(["crud", id, "--body", "-"], bridge, "Kept.\n"));
	assert.equal(ok(await run(["crud", id, "--title", "A better title"], bridge)), path);
	assert.match(readFileSync(join(bridge, path), "utf8"), /---\n\n# A better title\n\nKept\.\n$/);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), "crud: title");
});

test("adds a title to a doc that has none, above what it holds", async () => {
	const bridge = await tempBridge("crud-title-none");
	const path = ok(await run(["crud", "core:memo", "untitled"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	const text = readFileSync(join(bridge, path), "utf8");
	writeFileSync(join(bridge, path), text.replace("# untitled\n", "Loose text.\n"));
	ok(await run(["crud", id, "--title", "Titled"], bridge));
	assert.match(readFileSync(join(bridge, path), "utf8"), /---\n\n# Titled\n\nLoose text\.\n$/);
});

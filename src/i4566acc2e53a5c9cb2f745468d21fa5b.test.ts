// crud <quid> --meta:<path> <value>... [--section:<path> <source>]...
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { declareKinds, git, ok, run, tempBridge } from "../test/harness.ts";

test("sets meta at dot paths, values read as YAML, null removing one, with sections, in one commit", async () => {
	const bridge = await tempBridge("crud-meta-keyed");
	await declareKinds(bridge, "goal");
	const path = ok(await run(["crud", "goal", "a", "goal", "--meta", "-"], bridge, "keep: 1\ngone: 2\n"));
	const id = path.replace(/^.*\/|\.md$/g, "");
	const text = () => readFileSync(join(bridge, path), "utf8");
	const before = git(["rev-parse", "HEAD"], bridge);
	ok(await run(["crud", id, "--meta:a.b", "three", "--meta:count=3", "--meta:gone", "null", "--section:Brief", "-"], bridge, "Do it.\n"));
	assert.match(text(), /\nmeta:\n {2}keep: 1\n {2}a:\n {4}b: three\n {2}count: 3\n---\n/);
	assert.match(text(), /\n## Brief\n\nDo it\.\n$/);
	assert.equal(git(["rev-list", "--count", `${before}..HEAD`], bridge), "1");
	assert.match(git(["log", "-1", "--format=%s"], bridge), /crud: meta, section$/);
});

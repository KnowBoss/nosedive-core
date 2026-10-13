// crud <quid> --meta <source>
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { git, ok, run, tempBridge } from "./harness.ts";

test("merge-patches meta from stdin or a file, changing only that field, and commits", async () => {
	const bridge = await tempBridge("crud-meta");
	const path = ok(await run(["crud", "memo", "metered"], bridge));
	const id = path.replace(/^kb\/|\.md$/g, "");
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
	const id = path.replace(/^kb\/|\.md$/g, "");
	ok(await run(["crud", id, "--meta", "-"], bridge, "a: 1\n"));
	ok(await run(["crud", id, "--meta", "-"], bridge, "a: null\n"));
	assert.doesNotMatch(readFileSync(join(bridge, path), "utf8"), /meta/);
});

test("refuses a patch that is not a mapping", async () => {
	const bridge = await tempBridge("crud-meta-bad");
	const id = ok(await run(["crud", "memo", "x"], bridge)).replace(/^kb\/|\.md$/g, "");
	const result = await run(["crud", id, "--meta", "-"], bridge, "- a\n");
	assert.equal(result.code, 1);
	assert.match(result.err, /--meta takes a mapping/);
});

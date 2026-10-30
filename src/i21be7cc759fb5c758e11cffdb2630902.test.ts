// crud <quid> --links <source>
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { declareKinds, ok, run, tempBridge } from "../test/harness.ts";

test("adds and relabels links, keeping their order", async () => {
	const bridge = await tempBridge("crud-links");
	await declareKinds(bridge, "feat");
	const path = ok(await run(["crud", "feat", "linked"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");

	ok(await run(["crud", id, "--links", "-"], bridge, "kb/a.md:\n  rel: parent.feat\nkb/b.md: {}\n"));
	ok(await run(["crud", id, "--links", "-"], bridge, "kb/a.md:\n  rel: planned.dive\n"));

	assert.match(
		readFileSync(join(bridge, path), "utf8"),
		/\nlinks:\n {2}- kb\/a\.md:\n {6}rel: planned\.dive\n {2}- kb\/b\.md: \{\}\n---\n/,
	);
});

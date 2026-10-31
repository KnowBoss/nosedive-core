// drop-kb-docs
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1480bf8327315b11347f5e5f118a1 as dropKbDocs } from "./i01a1480bf8327315b11347f5e5f118a1.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { declareKinds, checkedOut, git, ok, run, tempBridge, tempDir } from "../test/harness.ts";

const core: Cape = await sourceCape();
const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");

test("drops docs across the bridge and workspace repos, one commit per repo", async () => {
	const bridge = await tempBridge("drop-kb-docs");
	await declareKinds(bridge, "goal");
	const repo = checkedOut(bridge, "other");
	// The checkout is no seeded repo, so the doc names the hero's kind, which must be published.
	const origin = tempDir("drop-kb-docs-origin");
	git(["init", "-q", "--bare", "-b", "main"], origin);
	git(["remote", "add", "origin", origin], bridge);
	git(["push", "-q", "origin", "main"], bridge);
	const here = ok(await run(["crud", "goal", "here"], bridge));
	const there = ok(await run(["--at", "workspace/other/kb", "crud", "goal", "there"], bridge));
	assert.deepEqual(dropKbDocs(bridge, [idOf(here), idOf(there)], false, [core]), [here, there]);
	assert.equal(existsSync(join(bridge, here)) || existsSync(join(bridge, there)), false);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), "crud: drop");
	assert.equal(git(["log", "-1", "--format=%s"], repo), "crud: drop");
});

test("names a doc it cannot find", async () => {
	const bridge = await tempBridge("drop-kb-docs-missing");
	await declareKinds(bridge, "goal");
	assert.throws(() => dropKbDocs(bridge, ["01a1480b-f832-7315-b113-47f5e5f118a1"], false, [core]), /no doc 01a1480b-f832-7315-b113-47f5e5f118a1 in the bridge/);
});

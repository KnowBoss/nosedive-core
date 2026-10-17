// drop-kb-docs
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Cape } from "../src/i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1480bf8327315b11347f5e5f118a1 as dropKbDocs } from "../src/i01a1480bf8327315b11347f5e5f118a1.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { checkedOut, git, ok, run, tempBridge } from "./harness.ts";

const core: Cape = await sourceCape();
const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");

test("drops docs across the bridge and workspace repos, one commit per repo", async () => {
	const bridge = await tempBridge("drop-kb-docs");
	const repo = checkedOut(bridge, "other");
	const here = ok(await run(["crud", "goal", "here"], bridge));
	const there = ok(await run(["crud", "other:goal", "there"], bridge));
	assert.deepEqual(dropKbDocs(bridge, [idOf(here), idOf(there)], false, [core]), [here, there]);
	assert.equal(existsSync(join(bridge, here)) || existsSync(join(bridge, there)), false);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), `crud(${idOf(here)}): dropped goal here-${idOf(here).slice(-6)}`);
	assert.equal(git(["log", "-1", "--format=%s"], repo), `crud(${idOf(there)}): dropped goal there-${idOf(there).slice(-6)}`);
});

test("names a doc it cannot find", async () => {
	const bridge = await tempBridge("drop-kb-docs-missing");
	assert.throws(() => dropKbDocs(bridge, ["01a1480b-f832-7315-b113-47f5e5f118a1"], false, [core]), /no doc 01a1480b-f832-7315-b113-47f5e5f118a1 in the bridge/);
});

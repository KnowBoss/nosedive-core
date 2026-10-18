// workspace-repo
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a138b2b8ed775297973c2aad478c8f as workspaceRepo } from "./i01a138b2b8ed775297973c2aad478c8f.ts";
import { checkedOut, tempBridge } from "../test/harness.ts";

test("finds a checkout, its kb its own bridge's when it is one, and refuses what is not checked out", async () => {
	const dir = await tempBridge("workspace-repo");
	const plain = checkedOut(dir, "plain");
	const own = checkedOut(dir, "own");
	mkdirSync(join(own, ".nosedive"));
	writeFileSync(join(own, ".nosedive", "config.yaml"), "kb: ./docs\n");
	const bridge = findBridge(dir)!;
	assert.deepEqual(workspaceRepo(bridge, "plain"), { dir: plain, kbDir: join(plain, "kb") });
	assert.deepEqual(workspaceRepo(bridge, "own"), { dir: own, kbDir: join(own, "docs") });
	assert.throws(() => workspaceRepo(bridge, "absent"), /absent is not checked out at workspace\/absent/);
});

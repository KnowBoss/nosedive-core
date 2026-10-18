// find-bridge
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { git, ok, run, tempBridge, tempDir } from "../test/harness.ts";

test("walks up to the nearest config and resolves its kb", () => {
	const dir = tempDir("find-bridge");
	mkdirSync(join(dir, ".nosedive"));
	writeFileSync(join(dir, ".nosedive", "config.yaml"), "bridge: b\nkb: ./docs\n");
	mkdirSync(join(dir, "deep", "er"), { recursive: true });
	const bridge = findBridge(join(dir, "deep", "er"));
	assert.equal(bridge?.dir, dir);
	assert.equal(bridge?.kbDir, join(dir, "docs"));
	assert.equal(bridge?.config.bridge, "b");
});

test("defaults the kb, and finds nothing outside a bridge", () => {
	const dir = tempDir("find-bridge-default");
	assert.equal(findBridge(dir), undefined);
	mkdirSync(join(dir, ".nosedive"));
	writeFileSync(join(dir, ".nosedive", "config.yaml"), "");
	assert.equal(findBridge(dir)?.kbDir, join(dir, "kb"));
});

test("the bridge is the nearest base, unless that base is checked out in another's workspace", async () => {
	const outer = await tempBridge("find-bridge-outer");
	const inner = join(outer, "workspace", "inner");
	mkdirSync(inner, { recursive: true });
	git(["init", "-q", "-b", "main"], inner);
	git(["config", "user.name", "Core Test"], inner);
	git(["config", "user.email", "core@example.com"], inner);
	ok(await run(["seed", "--root-kind", "base"], inner));
	assert.equal(findBridge(join(inner, "kb"))?.dir, outer, "a base in another's workspace is one of its repos");
	assert.equal(findBridge(outer)?.workspace, join(outer, "workspace"));
	assert.equal(findBridge(inner)?.workspace, join(outer, "workspace"));
});

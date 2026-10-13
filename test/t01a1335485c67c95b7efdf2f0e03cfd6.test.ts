// find-bridge
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "../src/a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { tempDir } from "./harness.ts";

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

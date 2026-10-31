// find-bridge
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge, insideWorkspace } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { ok, run, tempBridge, tempDir } from "../test/harness.ts";

test("walks up to the nearest config and resolves its kb, its first root's directory", () => {
	const dir = tempDir("find-bridge");
	mkdirSync(join(dir, ".nosedive"));
	writeFileSync(join(dir, ".nosedive", "config.yaml"), "bridge: b\nroots:\n  - docs/01a180ad-db94-7ea2-bcd0-b0b19236bf70.md\n");
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

test("a workspace checkout is never a hero: nosedive refuses to run inside one unless NOSEDIVE_HERO is set", async () => {
	const outer = await tempBridge("find-bridge-outer");
	const workspace = join(outer, "workspace");
	const inner = join(workspace, "inner");
	mkdirSync(join(inner, ".nosedive"), { recursive: true });
	writeFileSync(join(inner, ".nosedive", "config.yaml"), "workspace: ./workspace\n");
	assert.equal(findBridge(join(inner, "kb"))?.dir, inner, "the nearest config");
	assert.deepEqual(insideWorkspace(join(inner, "kb")), { hero: findBridge(outer), checkout: inner });
	assert.equal(insideWorkspace(workspace), undefined, "the workspace itself is in no checkout");
	assert.equal(insideWorkspace(outer), undefined);
	assert.match((await run(["help"], join(inner, "kb"))).err, /inner is checked out in .*'s workspace, and a checkout is never a hero: run nosedive from .*workspace \(with --at \.\/inner to write into it\), or set NOSEDIVE_HERO/);
	ok(await run(["help"], workspace));
	process.env.NOSEDIVE_HERO = inner;
	try {
		ok(await run(["help"], inner));
	} finally {
		delete process.env.NOSEDIVE_HERO;
	}
});

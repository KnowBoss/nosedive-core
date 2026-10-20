// find-kind
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a147171f057d019118aaa1f269f5fd as findKind } from "./i01a147171f057d019118aaa1f269f5fd.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { gitRepo, registerRepo, setCapes, tempBridge, tempDir } from "../test/harness.ts";

const core: Cape = await sourceCape();

test("finds a kind in the first kb that declares it, else in the capes, with its durability and links", () => {
	const kb = tempDir("find-kind");
	assert.deepEqual(findKind("memo", [kb], [core]), { ...(core.kinds.memo as object) });
	assert.equal(findKind("memo", [kb], [core])?.durable, true);
	writeFileSync(join(kb, "memo.md"), "---\nkind: kind\nid: m\nname: memo\nmeta:\n  schema:\n    type: object\n    additionalProperties: true\n---\n");
	assert.deepEqual(findKind("memo", [kb], [core]), { schema: { type: "object", additionalProperties: true }, links: [] }, "the kb overrides core, durability included");
	assert.equal(findKind("goal", [kb], [core]), undefined);
});

test("given a ship, finds a kind its configured capes' builds recorded, without loading them", async () => {
	const dir = await tempBridge("find-kind-ship");
	const repo = await registerRepo(dir, "kinded-cape", gitRepo("find-kind-cape"));
	setCapes(dir, ["kinded-cape"]);
	mkdirSync(join(dir, ".nosedive", "capes"), { recursive: true });
	const idea = { schema: { type: "object", additionalProperties: false }, durable: false, links: [] };
	const build = { id: "b", repo, ref: "", commit: "c", core: core.id, coreVersion: core.version, actions: {}, kinds: { idea }, needs: {}, version: "v", builtAt: "2026-01-01T00:00:00.000Z" };
	writeFileSync(join(dir, ".nosedive", "capes", "manifest.json"), JSON.stringify([build]));
	const ship = findBridge(dir)!;
	assert.equal(findKind("idea", [ship.kbDir], [core]), undefined, "not without the ship");
	assert.deepEqual(findKind("idea", [ship.kbDir], [core], ship), idea);
});

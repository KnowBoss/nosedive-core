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
	assert.deepEqual(findKind("memo", [kb], [core]), { ...(core.kinds.memo as object), from: core.name });
	assert.equal(findKind("memo", [kb], [core])?.durable, true);
	writeFileSync(join(kb, "memo.md"), "---\nkind: kind\nid: m\nname: memo\nmeta:\n  schema:\n    type: object\n    additionalProperties: true\n---\n");
	assert.deepEqual(findKind("memo", [kb], [core]), { schema: { type: "object", additionalProperties: true }, links: [], id: "m", from: "hero" }, "the kb overrides core, durability included");
	assert.equal(findKind("goal", [kb], [core]), undefined);
});

test("given a hero repo, finds a kind its configured capes' builds recorded, without loading them", async () => {
	const dir = await tempBridge("find-kind-hero");
	const repo = await registerRepo(dir, "kinded-cape", gitRepo("find-kind-cape"));
	setCapes(dir, ["kinded-cape"]);
	mkdirSync(join(dir, ".nosedive", "capes"), { recursive: true });
	const idea = { schema: { type: "object", additionalProperties: false }, durable: false, links: [] };
	const build = { id: "b", repo, ref: "", commit: "c", core: core.id, coreVersion: core.version, actions: {}, kinds: { idea }, needs: {}, version: "v", builtAt: "2026-01-01T00:00:00.000Z" };
	writeFileSync(join(dir, ".nosedive", "capes", "manifest.json"), JSON.stringify([build]));
	const hero = findBridge(dir)!;
	assert.equal(findKind("idea", [hero.kbDir], [core]), undefined, "not without the hero");
	assert.deepEqual(findKind("idea", [hero.kbDir], [core], hero), { ...idea, from: "kinded-cape" });
});

test("a bare kind is the hero's own, else the one worn cape's, else core's; <cape>:<kind> picks one; two capes tie", () => {
	const kb = tempDir("find-kind-order");
	const cape = (name: string, kinds: Record<string, unknown>) => ({ ...core, name, kinds }) as Cape;
	const greet = cape("greet-cape", { memo: { durable: false } });
	assert.equal(findKind("memo", [kb], [core, greet])?.from, "greet-cape", "a worn cape's over core's");
	assert.equal(findKind("nosedive-core:memo", [kb], [core, greet])?.from, "nosedive-core");
	assert.throws(() => findKind("greet-cape:goal", [kb], [core, greet]), /greet-cape declares no kind goal/);
	assert.throws(() => findKind("memo", [kb], [core, greet, cape("wave-cape", { memo: {} })]), /greet-cape:memo and wave-cape:memo both declare memo: name one/);
	assert.equal(findKind("wave-cape:memo", [kb], [core, greet, cape("wave-cape", { memo: {} })])?.from, "wave-cape");
	writeFileSync(join(kb, "memo.md"), "---\nkind: kind\nid: m\nname: memo\n---\n");
	assert.equal(findKind("memo", [kb], [core, greet, cape("wave-cape", { memo: {} })])?.from, "hero", "the hero's own over any cape's");
});

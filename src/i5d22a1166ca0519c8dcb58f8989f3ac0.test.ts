// crud
import assert from "node:assert/strict";
import { basename } from "node:path";
import { test } from "node:test";
import { i01a1337c810a7456876b831d0c873396 as capeManifest } from "./i01a1337c810a7456876b831d0c873396.ts";
import { CORE, ok, registerRepo, run, setCapes, tempBridge } from "../test/harness.ts";

test("lists the repo's own kinds bare, then each cape's with the spellings that reach them", async () => {
	const dir = await tempBridge("crud-list");
	ok(await run(["crud", "core:kind", "An", "idea", "--name", "idea", "--meta", "-"], dir, "schema:\n  type: object\n  additionalProperties: true\n"));
	const [own, core] = ok(await run(["crud"], dir)).split("\n\n");
	assert.equal(own, `${basename(dir)}\n  idea`);
	const lines = core!.split("\n");
	assert.equal(lines[0], "core");
	assert.ok(lines.includes(`  (core|nosedive-core|${CORE}):memo`));
	assert.deepEqual(lines.slice(1), [...lines.slice(1)].sort(), "in order");
});

test("refuses outside a bridge", async () => {
	const dir = await tempBridge("crud-list-outside");
	assert.match((await run(["crud"], `${dir}/..`)).err, /not in a bridge: run `nosedive seed` first/);
});

test("prints no header for a cape that declares no kinds", async () => {
	const dir = await tempBridge("crud-list-quiet");
	const repo = await registerRepo(dir, "quiet-cape");
	setCapes(dir, ["quiet-cape"]);
	const build = { id: "quiet-1", owner: "01a18e8a-0000-7000-8000-000000000002", shortName: "quiet", repo, ref: "", commit: "a".repeat(40), core: CORE, coreVersion: "1", actions: {}, needs: {}, version: "1", builtAt: "2026-10-30T00:00:00.000Z" };
	capeManifest(dir, { ...build, kinds: {} });
	const groups = ok(await run(["crud"], dir)).split("\n\n").map((group) => group.split("\n")[0]);
	assert.deepEqual(groups, [basename(dir), "core"]);
});

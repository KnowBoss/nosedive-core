// local-capes
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1934563e77ed886f06d04416385ef as localCapes, nestedRoot } from "./i01a1934563e77ed886f06d04416385ef.ts";
import { ok, run, tempBridge } from "../test/harness.ts";

test("lists the cape roots a hero's config lists that a nested seeded directory holds, wherever they lie", async () => {
	const hero = await tempBridge("local-capes");
	assert.deepEqual(localCapes(findBridge(hero)!), []);
	ok(await run(["--at", "tools/spec", "seed", "--root-kind", "cape"], hero));
	const bridge = findBridge(hero)!;
	assert.equal(bridge.roots.length, 2);
	assert.deepEqual(localCapes(bridge).map(({ name, dir }) => [name, dir]), [["spec", join(hero, "tools", "spec")]]);
	assert.deepEqual(bridge.roots.map((root) => nestedRoot(bridge, root)), [false, true]);
});

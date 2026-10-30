// crud
import assert from "node:assert/strict";
import { basename } from "node:path";
import { test } from "node:test";
import { CORE, ok, run, tempBridge } from "../test/harness.ts";

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

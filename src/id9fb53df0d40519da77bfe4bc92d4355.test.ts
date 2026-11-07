// crud --drop-list <source> --sure [--hard]
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { declareKinds, ok, run, tempBridge } from "../test/harness.ts";

test("drops listed docs that hang from none only when sure", async () => {
	const bridge = await tempBridge("crud-drop-list-sure");
	await declareKinds(bridge, "goal");
	const [a, b] = [ok(await run(["crud", "goal", "a"], bridge)), ok(await run(["crud", "goal", "b"], bridge))];
	const ids = [a, b].map((path) => path.replace(/^.*\/|\.md$/g, "")).join("\n");
	assert.match((await run(["crud", "--drop-list", "-"], bridge, ids)).err, /none of these was dropped:\n {2}goal a-\w{6}: it hangs from no doc/);
	assert.equal(ok(await run(["crud", "--drop-list", "-", "--sure"], bridge, ids)), `${a}\n${b}`);
	assert.equal(existsSync(join(bridge, a)) || existsSync(join(bridge, b)), false);
});

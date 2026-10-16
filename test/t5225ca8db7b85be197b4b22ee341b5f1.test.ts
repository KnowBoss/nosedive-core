// crud <quid> --kind <kind>
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ok, run, tempBridge } from "./harness.ts";

test("changes the kind, refusing meta the new kind's schema forbids, and warning on an undeclared kind", async () => {
	const bridge = await tempBridge("crud-kind");
	const path = ok(await run(["crud", "memo", "a", "note"], bridge));
	const id = path.replace(/^kb\/|\.md$/g, "");
	ok(await run(["crud", id, "--meta", "-"], bridge, "owner: dan\n"));

	const refused = await run(["crud", id, "--kind", "repo"], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /meta does not fit kind repo/);
	assert.match(readFileSync(join(bridge, path), "utf8"), /\nkind: memo\n/);

	const goal = await run(["crud", id, "--kind", "goal"], bridge);
	assert.equal(goal.code, 0);
	assert.match(goal.err, /no kind goal is declared here/);
	assert.match(readFileSync(join(bridge, path), "utf8"), /\nkind: goal\n/);
});

// crud <quid> --kind <kind>
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { CORE, ok, run, tempBridge } from "../test/harness.ts";

test("changes the kind, refusing meta the new kind's schema forbids, and warning on an undeclared kind", async () => {
	const bridge = await tempBridge("crud-kind");
	const path = ok(await run(["crud", "core:memo", "a", "note"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	ok(await run(["crud", id, "--meta", "-"], bridge, "owner: dan\n"));

	const refused = await run(["crud", id, "--kind", "core:repo"], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /meta does not fit kind \S+:repo/);
	assert.match(readFileSync(join(bridge, path), "utf8"), /\nkind: memo\n/);

	// A bare kind is this repo's own, so the doc no longer names core as its kind's owner.
	const goal = await run(["crud", id, "--kind", "goal"], bridge);
	assert.equal(goal.code, 0);
	assert.match(goal.err, /no kind goal is declared here/);
	assert.match(readFileSync(join(bridge, path), "utf8"), /\nkind: goal\n/);
	assert.doesNotMatch(readFileSync(join(bridge, path), "utf8"), /canonical|scopes/);

	ok(await run(["crud", id, "--kind", "core:memo"], bridge));
	assert.match(readFileSync(join(bridge, path), "utf8"), new RegExp(`\nkind: memo\n[^]*scopes:\n  - ${CORE}:\n      canonical: true\n      version: [0-9a-f]{40}\n`));
	assert.match((await run(["crud", id, "--kind", "nope:memo"], bridge)).err, /nope:memo names no kind; memo is reached as core:memo/);
});

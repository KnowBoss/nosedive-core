// crud <quid> --kind <kind>
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { CORE, declareKinds, ok, run, tempBridge } from "../test/harness.ts";

test("changes the kind, refusing meta the new kind's schema forbids, and refusing a bare kind the repo does not declare", async () => {
	const bridge = await tempBridge("crud-kind");
	const path = ok(await run(["crud", "core:memo", "a", "note"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	ok(await run(["crud", id, "--meta", "-"], bridge, "owner: dan\n"));

	const refused = await run(["crud", id, "--kind", "core:repo"], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /meta does not fit kind \S+:repo/);
	assert.match(readFileSync(join(bridge, path), "utf8"), /\nkind: memo\n/);

	// A bare kind is this repo's own, so it must declare it.
	const undeclared = await run(["crud", id, "--kind", "goal"], bridge);
	assert.equal(undeclared.code, 1);
	assert.match(undeclared.err, /no kind goal is declared here, and a bare kind is the repo's own: the hero can declare one of that name/);
	assert.match(readFileSync(join(bridge, path), "utf8"), /\nkind: memo\n/, "unchanged");
	await declareKinds(bridge, "goal");
	ok(await run(["crud", id, "--kind", "goal"], bridge));
	assert.match(readFileSync(join(bridge, path), "utf8"), /\nkind: goal\n/);
	assert.doesNotMatch(readFileSync(join(bridge, path), "utf8"), /canonical|scopes/);

	ok(await run(["crud", id, "--kind", "core:memo"], bridge));
	assert.match(readFileSync(join(bridge, path), "utf8"), new RegExp(`\nkind: memo\n[^]*scopes:\n  - ${CORE}:\n      canonical: true\n      version: [0-9a-f]{40}\n      schema: [0-9a-f]{12}\n`));
	assert.match((await run(["crud", id, "--kind", "nope:memo"], bridge)).err, /nope:memo names no kind; memo is reached as core:memo/);
});

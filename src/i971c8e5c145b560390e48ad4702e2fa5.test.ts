// crud <quid> --name <name>
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ok, run, tempBridge } from "../test/harness.ts";

test("renames a doc, and refuses a name that is not a slug", async () => {
	const bridge = await tempBridge("crud-name");
	const path = ok(await run(["crud", "memo", "a", "note"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	ok(await run(["crud", id, "--name", "better.name"], bridge));
	assert.match(readFileSync(join(bridge, path), "utf8"), /\nname: better\.name\n/);
	const refused = await run(["crud", id, "--name", "Not A Slug"], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /--name must be lowercase letters, digits, dots and dashes/);
});

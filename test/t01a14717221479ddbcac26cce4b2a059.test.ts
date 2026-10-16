// update-kb-doc-body
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a14717221479ddbcac26cce4b2a059 as updateKbDocBody } from "../src/i01a14717221479ddbcac26cce4b2a059.ts";
import { git, ok, run, tempBridge } from "./harness.ts";

test("writes the updated body under the same frontmatter, and commits; a throwing update writes nothing", async () => {
	const bridge = await tempBridge("update-body");
	const path = ok(await run(["crud", "memo", "a", "note"], bridge));
	const id = path.replace(/^kb\/|\.md$/g, "");
	const before = readFileSync(join(bridge, path), "utf8");
	assert.equal(updateKbDocBody(bridge, id, (body) => `${body}\nAdded.\n`), path);
	assert.equal(readFileSync(join(bridge, path), "utf8"), `${before}\nAdded.\n`);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), `crud(${id}): updated memo a-note-${id.slice(-6)}`);

	assert.throws(() => updateKbDocBody(bridge, id, () => {
		throw new Error("refused");
	}), /refused/);
	assert.equal(readFileSync(join(bridge, path), "utf8"), `${before}\nAdded.\n`);
});

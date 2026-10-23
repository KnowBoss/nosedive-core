// update-kb-doc-body
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a14717221479ddbcac26cce4b2a059 as updateKbDocBody } from "./i01a14717221479ddbcac26cce4b2a059.ts";
import { i01a14ab1d36771eea2bc6f13bdeb0526 as editKbDocs } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { git, ok, run, tempBridge } from "../test/harness.ts";

test("sets the updated body under the same frontmatter; a throwing update changes nothing", async () => {
	const bridge = await tempBridge("update-body");
	const path = ok(await run(["crud", "memo", "a", "note"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	const before = readFileSync(join(bridge, path), "utf8");

	const edit = editKbDocs(bridge);
	updateKbDocBody(edit, id, (body) => `${body}\nAdded.\n`);
	edit.commit();
	assert.equal(readFileSync(join(bridge, path), "utf8"), `${before}\nAdded.\n`);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), `crud(${id}): updated memo a-note-${id.slice(-6)}`);

	const refused = editKbDocs(bridge);
	assert.throws(() => updateKbDocBody(refused, id, () => {
		throw new Error("refused");
	}), /refused/);
	assert.deepEqual(refused.commit(), []);
	assert.equal(readFileSync(join(bridge, path), "utf8"), `${before}\nAdded.\n`);
});

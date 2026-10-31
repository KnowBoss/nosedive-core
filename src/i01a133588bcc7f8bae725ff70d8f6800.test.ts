// update-kb-doc-field
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "./i01a133588bcc7f8bae725ff70d8f6800.ts";
import { i01a14ab1d36771eea2bc6f13bdeb0526 as editKbDocs } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { git, tempBridge, kbPath } from "../test/harness.ts";

const ID = "01a1335b-f253-7b80-ab64-d2f9a03c9634";

test("sets, then removes, one field, which later updates in the same edit see", async () => {
	const bridge = await tempBridge("update-field");
	const path = kbPath(bridge, ID);
	writeFileSync(join(bridge, path), `---\nkind: memo\nid: ${ID}\nname: fielded\n---\n`);
	git(["add", path], bridge);
	git(["commit", "-qm", "doc"], bridge);

	const edit = editKbDocs(bridge, "test");
	updateKbDocField(edit, ID, "owner", () => "dan");
	updateKbDocField(edit, ID, "owner", (owner) => `${String(owner)} and sam`);
	assert.equal(readFileSync(join(bridge, path), "utf8"), `---\nkind: memo\nid: ${ID}\nname: fielded\n---\n`, "nothing is written before the commit");
	assert.deepEqual(edit.commit(), [path]);
	assert.match(readFileSync(join(bridge, path), "utf8"), /\nowner: dan and sam\n---/);

	const removal = editKbDocs(bridge, "test");
	updateKbDocField(removal, ID, "owner", () => undefined);
	removal.commit();
	assert.doesNotMatch(readFileSync(join(bridge, path), "utf8"), /owner/);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), "crud: edit");
	assert.equal(git(["rev-list", "--count", "HEAD"], bridge), "4");
});

// update-kb-doc-field
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { a01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "../src/a01a133588bcc7f8bae725ff70d8f6800.ts";
import { git, tempBridge, tempDir } from "./harness.ts";

const ID = "01a1335b-f253-7b80-ab64-d2f9a03c9634";

test("sets, then removes, one field and commits each change", async () => {
	const bridge = await tempBridge("update-field");
	const path = `kb/${ID}.md`;
	writeFileSync(join(bridge, path), `---\nkind: memo\nid: ${ID}\nname: fielded\n---\n`);
	git(["add", path], bridge);
	git(["commit", "-qm", "doc"], bridge);
	assert.equal(updateKbDocField(bridge, ID, "owner", () => "dan"), path);
	assert.match(readFileSync(join(bridge, path), "utf8"), /\nowner: dan\n---/);
	updateKbDocField(bridge, ID, "owner", () => undefined);
	assert.doesNotMatch(readFileSync(join(bridge, path), "utf8"), /owner/);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), `crud(${ID}): updated memo fielded`);
	assert.equal(git(["rev-list", "--count", "HEAD"], bridge), "4");
});

test("refuses outside a bridge and for a missing doc", async () => {
	assert.throws(() => updateKbDocField(tempDir("update-none"), "x", "f", () => 1), /not in a bridge/);
	const bridge = await tempBridge("update-missing");
	assert.throws(() => updateKbDocField(bridge, "01a1335b-f3bd-7ef4-9eb1-98115e3ba276", "f", () => 1), /no doc 01a1335b-f3bd-7ef4-9eb1-98115e3ba276 in the bridge or its workspace/);
});

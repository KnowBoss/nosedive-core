// update-kb-doc-field
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { a01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "../src/a01a133588bcc7f8bae725ff70d8f6800.ts";
import { git, ok, run, tempBridge, tempDir } from "./harness.ts";

test("sets, then removes, one field and commits each change", async () => {
	const bridge = await tempBridge("update-field");
	const path = ok(await run(["crud", "memo", "fielded"], bridge));
	const id = path.replace(/^kb\/|\.md$/g, "");
	assert.equal(updateKbDocField(bridge, id, "owner", () => "dan"), path);
	assert.match(readFileSync(join(bridge, path), "utf8"), /\nowner: dan\n---/);
	updateKbDocField(bridge, id, "owner", () => undefined);
	assert.doesNotMatch(readFileSync(join(bridge, path), "utf8"), /owner/);
	assert.equal(git(["rev-list", "--count", "HEAD"], bridge), "4");
});

test("refuses outside a bridge and for a missing doc", async () => {
	assert.throws(() => updateKbDocField(tempDir("update-none"), "x", "f", () => 1), /not in a bridge/);
	const bridge = await tempBridge("update-missing");
	assert.throws(() => updateKbDocField(bridge, "01a1335b-f3bd-7ef4-9eb1-98115e3ba276", "f", () => 1), /no doc 01a1335b-f3bd/);
});

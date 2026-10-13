// usage-id
import assert from "node:assert/strict";
import { test } from "node:test";
import { a01a133548178739398941123114401ad as usageId } from "../src/a01a133548178739398941123114401ad.ts";

const CRUD = "01a13354-7dea-7604-b903-b94a5aca2b83";

test("ignores spacing, and changes with the wording or the action", () => {
	assert.equal(usageId("crud <quid>", CRUD), "f4a09298430355a2a473394fbb5103f2");
	assert.equal(usageId("  crud   <quid> ", CRUD), "f4a09298430355a2a473394fbb5103f2");
	assert.notEqual(usageId("crud <id>", CRUD), "f4a09298430355a2a473394fbb5103f2");
	assert.notEqual(usageId("crud <quid>", "01a13354-7ea8-7883-b6ac-c99ddff5d5a8"), "f4a09298430355a2a473394fbb5103f2");
});

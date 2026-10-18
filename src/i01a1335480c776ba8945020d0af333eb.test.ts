// mint-uuid
import assert from "node:assert/strict";
import { test } from "node:test";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "./i01a1335480c776ba8945020d0af333eb.ts";

test("mints v7 uuids that sort by time", () => {
	const early = mintUuid(1_000_000_000_000);
	const late = mintUuid(1_000_000_000_001);
	assert.match(early, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	assert.ok(early < late);
	assert.notEqual(mintUuid(5), mintUuid(5));
});

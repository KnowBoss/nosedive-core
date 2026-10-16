// namespaced-uuid
import assert from "node:assert/strict";
import { test } from "node:test";
import { i01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "../src/i01a1335480147d0686528aee80f8ee34.ts";

test("matches RFC 4122's uuidv5 for a known pair", () => {
	// python: uuid.uuid5(uuid.NAMESPACE_DNS, "python.org")
	assert.equal(namespacedUuid("python.org", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"), "886313e1-3b8a-5372-9b90-0c9aee199e5d");
});

test("refuses a namespace that is not a uuid", () => {
	assert.throws(() => namespacedUuid("x", "nope"), /not a uuid: nope/);
});

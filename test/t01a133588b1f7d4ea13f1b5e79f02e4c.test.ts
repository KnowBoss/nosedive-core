// merge-keyed-entries
import assert from "node:assert/strict";
import { test } from "node:test";
import { a01a133588b1f7d4ea13f1b5e79f02e4c as mergeKeyedEntries } from "../src/a01a133588b1f7d4ea13f1b5e79f02e4c.ts";

test("merges onto entries by key, appends new keys, and removes on null", () => {
	const list = [{ a: { ref: "1" } }, "b", { c: null }];
	assert.deepEqual(mergeKeyedEntries(list, { a: { branch: "x" }, b: { rel: "r" }, c: null, d: {} }), [
		{ a: { ref: "1", branch: "x" } },
		{ b: { rel: "r" } },
		{ d: null },
	]);
	assert.deepEqual(mergeKeyedEntries(undefined, { a: { x: 1 } }), [{ a: { x: 1 } }]);
});

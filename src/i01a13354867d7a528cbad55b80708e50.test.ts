// merge-patch
import assert from "node:assert/strict";
import { test } from "node:test";
import { i01a13354867d7a528cbad55b80708e50 as mergePatch } from "./i01a13354867d7a528cbad55b80708e50.ts";

test("follows RFC 7386", () => {
	assert.deepEqual(mergePatch({ a: "b", c: { d: "e", f: "g" } }, { a: "z", c: { f: null } }), { a: "z", c: { d: "e" } });
	assert.deepEqual(mergePatch({ a: [1] }, { a: [2] }), { a: [2] });
	assert.deepEqual(mergePatch("x", { a: 1 }), { a: 1 });
	assert.equal(mergePatch({ a: 1 }, "x"), "x");
});

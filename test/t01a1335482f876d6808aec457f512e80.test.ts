// read-kb-doc
import assert from "node:assert/strict";
import { test } from "node:test";
import { a01a1335482f876d6808aec457f512e80 as readKbDoc } from "../src/a01a1335482f876d6808aec457f512e80.ts";

test("splits frontmatter from body", () => {
	const doc = readKbDoc('---\nkind: memo\ngist: "g"\n---\n\n# Title\n');
	assert.deepEqual(doc.fm, { kind: "memo", gist: "g" });
	assert.equal(doc.body, "\n# Title\n");
});

test("refuses text without frontmatter, or frontmatter that is not a mapping", () => {
	assert.throws(() => readKbDoc("# Title\n", "x.md"), /x\.md has no frontmatter/);
	assert.throws(() => readKbDoc("---\n- a\n---\n", "x.md"), /x\.md frontmatter is not a mapping/);
});

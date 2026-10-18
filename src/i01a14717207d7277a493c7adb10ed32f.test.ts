// split-title
import assert from "node:assert/strict";
import { test } from "node:test";
import { i01a14717207d7277a493c7adb10ed32f as splitTitle } from "./i01a14717207d7277a493c7adb10ed32f.ts";

test("splits the leading # heading from what is under it", () => {
	assert.deepEqual(splitTitle("\n# A title\n\nUnder.\n"), { title: "A title", under: "\nUnder.\n" });
	assert.deepEqual(splitTitle("# Only"), { title: "Only", under: "" });
});

test("finds no title unless the first non-blank line is a # heading", () => {
	assert.equal(splitTitle("\nText first.\n\n# Later\n"), undefined);
	assert.equal(splitTitle("\n## Code\n"), undefined);
	assert.equal(splitTitle(""), undefined);
});

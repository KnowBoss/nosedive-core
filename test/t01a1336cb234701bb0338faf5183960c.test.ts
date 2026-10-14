// code-section
import assert from "node:assert/strict";
import { test } from "node:test";
import { a01a1336cb234701bb0338faf5183960c as codeSection } from "../src/a01a1336cb234701bb0338faf5183960c.ts";

const action = { kind: "action" as const, name: "greet", gist: "", text: "", body: "", top: true, usages: [{ id: "abc", text: "greet <who>" }] };
const helper = { ...action, usages: [] };

test("links a user action's entrypoint and each usage's impl and tests", () => {
	assert.equal(
		codeSection("\n# Greet\n\nSays hi.\n", action, "a01"),
		"\n# Greet\n\nSays hi.\n\n## Code\n\n- Entrypoint: [src/a01.ts](../src/a01.ts)\n- `greet <who>`: [impl](../src/iabc.ts), [tests](../test/tabc.test.ts)\n",
	);
});

test("links an internal function and its tests", () => {
	assert.match(codeSection("\n# Shout\n", helper, "a02"), /- Function: \[src\/a02\.ts\]\(\.\.\/src\/a02\.ts\)\n- Tests: \[test\/t02\.test\.ts\]/);
});

test("replaces a stale section in place, keeping the sections after it", () => {
	const body = "\n# Greet\n\n## Code\n\n- old\n\n## Notes\n\nKept.\n";
	const next = codeSection(body, action, "a01");
	assert.doesNotMatch(next, /- old/);
	assert.match(next, /## Notes\n\nKept\.\n\n## Code\n/);
	assert.equal(codeSection(next, action, "a01"), next);
});

test("is stable on a body that is nothing but the section", () => {
	const once = codeSection("", action, "a01");
	assert.equal(codeSection(once, action, "a01"), once);
	assert.equal(codeSection(once.trim(), action, "a01").trim(), once.trim());
});

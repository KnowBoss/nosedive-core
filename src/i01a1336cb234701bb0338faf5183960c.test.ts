// code-section
import assert from "node:assert/strict";
import { test } from "node:test";
import { i01a1336cb234701bb0338faf5183960c as codeSection } from "./i01a1336cb234701bb0338faf5183960c.ts";

const action = { kind: "action" as const, name: "greet", gist: "", text: "", body: "", top: true, usages: [{ id: "abc", text: "greet <who>" }] };
const helper = { ...action, kind: "function" as const, usages: [] };

test("links a user action's entrypoint and each usage's impl and tests", () => {
	assert.equal(
		codeSection("\n# Greet\n\nSays hi.\n", action, "i01"),
		"\n# Greet\n\nSays hi.\n\n## Code\n\n- Entrypoint: [src/i01.ts](../src/i01.ts)\n- `greet <who>`: [impl](../src/iabc.ts), [tests](../src/iabc.test.ts)\n",
	);
});

test("links a function and its tests", () => {
	assert.match(codeSection("\n# Shout\n", helper, "i02"), /- Function: \[src\/i02\.ts\]\(\.\.\/src\/i02\.ts\)\n- Tests: \[src\/i02\.test\.ts\]\(\.\.\/src\/i02\.test\.ts\)/);
});

test("replaces a stale section in place, keeping the sections after it", () => {
	const body = "\n# Greet\n\n## Code\n\n- old\n\n## Notes\n\nKept.\n";
	const next = codeSection(body, action, "i01");
	assert.doesNotMatch(next, /- old/);
	assert.match(next, /## Notes\n\nKept\.\n\n## Code\n/);
	assert.equal(codeSection(next, action, "i01"), next);
});

test("is stable on a body that is nothing but the section", () => {
	const once = codeSection("", action, "i01");
	assert.equal(codeSection(once, action, "i01"), once);
	assert.equal(codeSection(once.trim(), action, "i01").trim(), once.trim());
});

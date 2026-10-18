// kb-doc-kind
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a14fdf275b70b48f86f7f5c651719d as kbDocKind } from "../src/i01a14fdf275b70b48f86f7f5c651719d.ts";
import { tempDir } from "./harness.ts";

test("reads the kind a doc's frontmatter names, wherever in it, and nothing from its body or a file without frontmatter", () => {
	const dir = tempDir("kb-doc-kind");
	const doc = (name: string, text: string) => {
		writeFileSync(join(dir, name), text);
		return kbDocKind(join(dir, name));
	};
	assert.equal(doc("first.md", "---\nkind: action\nid: x\n---\n# A\n"), "action");
	assert.equal(doc("quoted.md", '---\r\nkind: "function"\r\n---\r\n'), "function");
	assert.equal(doc("late.md", `---\nlinks:\n${"  - kb/x.md:\n      rel: child.feat\n".repeat(60)}kind: kind\n---\n`), "kind");
	assert.equal(doc("body.md", "---\nid: x\n---\n\nkind: action\n"), undefined);
	assert.equal(doc("nested.md", "---\nmeta:\n  kind: action\n---\n"), undefined);
	assert.equal(doc("plain.md", "# no frontmatter\nkind: action\n"), undefined);
	assert.equal(doc("empty.md", ""), undefined);
});

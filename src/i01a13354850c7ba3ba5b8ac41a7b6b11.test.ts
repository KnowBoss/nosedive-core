// list-kb-docs
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./i01a13354850c7ba3ba5b8ac41a7b6b11.ts";
import { tempDir } from "../test/harness.ts";

test("lists markdown docs with frontmatter, in filename order, skipping the rest", () => {
	const kb = tempDir("list-kb-docs");
	writeFileSync(join(kb, "b.md"), "---\nname: b\n---\n");
	writeFileSync(join(kb, "a.md"), "---\nname: a\n---\n");
	writeFileSync(join(kb, "plain.md"), "# no frontmatter\n");
	writeFileSync(join(kb, "notes.txt"), "---\nname: txt\n---\n");
	assert.deepEqual(
		listKbDocs(kb).map((doc) => doc.fm.name),
		["a", "b"],
	);
});

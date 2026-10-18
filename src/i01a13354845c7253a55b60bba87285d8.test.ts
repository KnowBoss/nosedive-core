// find-kb-doc
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { tempDir } from "../test/harness.ts";

const ID = "01a1335b-f253-7b80-ab64-d2f9a03c9634";

test("finds a doc by the file its id names, or nothing", () => {
	const kb = tempDir("find-kb-doc");
	writeFileSync(join(kb, `${ID}.md`), `---\nid: ${ID}\n---\n`);
	assert.equal(findKbDoc(kb, ID)?.fm.id, ID);
	assert.equal(findKbDoc(kb, "01a1335b-f30a-7dd2-a1d4-b675fd419238"), undefined);
});

// write-kb-doc
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "../src/i01a1335482f876d6808aec457f512e80.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "../src/i01a1335483aa776cb84df698b04adc06.ts";
import { tempDir } from "./harness.ts";

test("changes only the field that was set, keeping quoting and comments elsewhere", () => {
	const text = '---\nkind: memo # a comment\ngist: "quoted, kept"\nname: n\n---\n\nBody.\n';
	const doc = readKbDoc(text);
	doc.yaml.set("name", "renamed");
	const path = join(tempDir("write-kb-doc"), "doc.md");
	writeKbDoc(path, doc.yaml, doc.body);
	assert.equal(readFileSync(path, "utf8"), text.replace("name: n", "name: renamed"));
});

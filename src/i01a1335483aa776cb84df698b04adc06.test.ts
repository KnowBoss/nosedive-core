// write-kb-doc
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "./i01a1335483aa776cb84df698b04adc06.ts";
import { tempDir } from "../test/harness.ts";

test("changes only the field that was set, keeping quoting and comments elsewhere", () => {
	const text = '---\nkind: memo # a comment\nname: n\ngist: "quoted, kept"\n---\n\nBody.\n';
	const doc = readKbDoc(text);
	doc.yaml.set("name", "renamed");
	const path = join(tempDir("write-kb-doc"), "doc.md");
	writeKbDoc(path, doc.yaml, doc.body);
	assert.equal(readFileSync(path, "utf8"), text.replace("name: n", "name: renamed"));
});

test("orders frontmatter KINGSMETAL, other keys in place before links, nested order untouched", () => {
	const text = [
		"---",
		"links:",
		"  - kb/x.md:",
		"      rel: parent.feat",
		"zeta: 1",
		"meta:",
		"  b: 1",
		"  a: 2",
		"gist: g",
		"alpha: 2",
		"name: n",
		"id: i",
		"kind: memo",
		"scopes: []",
		"---",
		"",
		"Body.",
		"",
	].join("\n");
	const doc = readKbDoc(text);
	const path = join(tempDir("write-kb-doc-order"), "doc.md");
	writeKbDoc(path, doc.yaml, doc.body);
	const keys = readFileSync(path, "utf8").split("\n").filter((line) => /^[\w-]+:/.test(line)).map((line) => line.split(":")[0]);
	assert.deepEqual(keys, ["kind", "id", "name", "gist", "scopes", "meta", "zeta", "alpha", "links"]);
	assert.match(readFileSync(path, "utf8"), /meta:\n {2}b: 1\n {2}a: 2\n/);
});

function written(text: string): string {
	const doc = readKbDoc(text);
	const path = join(tempDir("write-kb-doc-edge"), "doc.md");
	writeKbDoc(path, doc.yaml, doc.body);
	return readFileSync(path, "utf8");
}

test("keeps a header comment on top and no blank under the opening fence", () => {
	assert.equal(written("---\n# header\nname: n\n\nkind: memo\n---\nB\n"), "---\n# header\nkind: memo\n\nname: n\n---\nB\n");
	assert.equal(written("---\n# header\n\nname: n\nkind: memo\n---\nB\n"), "---\n# header\n\nkind: memo\nname: n\n---\nB\n");
	assert.equal(written("---\nname: n\n\nkind: memo\n---\nB\n"), "---\nkind: memo\n\nname: n\n---\nB\n");
});

test("keeps a blank line between keys when pairs move", () => {
	assert.equal(written("---\nzeta: 1\n\nname: n\nkind: memo\n\nlinks: []\n---\nB\n"), "---\nkind: memo\n\nname: n\nzeta: 1\n\nlinks: []\n---\nB\n");
});

test("leaves the order of a doc with aliases, so none comes before its anchor", () => {
	const text = "---\nname: &n x\nkind: memo\nother: *n\n---\nB\n";
	assert.equal(written(text), text);
});

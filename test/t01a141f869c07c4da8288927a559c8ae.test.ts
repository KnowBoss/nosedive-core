// mint-kb-doc
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { i01a141f869c07c4da8288927a559c8ae as mintKbDoc } from "../src/i01a141f869c07c4da8288927a559c8ae.ts";
import { tempDir } from "./harness.ts";

test("writes a doc with a minted id, a name slugged from its gist, and its meta", () => {
	const kb = tempDir("mint-kb-doc");
	const doc = mintKbDoc(kb, { kind: "repo", gist: "The greet cape: says hi", meta: { remotes: { cloud: "https://example.com/g.git" } } });
	assert.equal(doc.name, `the-greet-cape-says-hi-${doc.id.slice(-6)}`);
	assert.equal(
		readFileSync(doc.path, "utf8"),
		[
			"---",
			"kind: repo",
			`id: ${doc.id}`,
			`name: ${doc.name}`,
			'gist: "The greet cape: says hi"',
			"meta:",
			"  remotes:",
			"    cloud: https://example.com/g.git",
			"---",
			"",
			"# The greet cape: says hi",
			"",
		].join(String.fromCharCode(10)),
	);
});

test("takes a given id, name and title, and never overwrites", () => {
	const kb = tempDir("mint-kb-doc-given");
	const given = { kind: "base", id: "01a141ff-2539-7f5d-b07d-52a11fd6acb9", name: "my-base", gist: "What my-base holds", title: "my-base" };
	const doc = mintKbDoc(kb, given);
	assert.deepEqual([doc.id, doc.name], [given.id, "my-base"]);
	assert.match(readFileSync(doc.path, "utf8"), /# my-base/);
	assert.throws(() => mintKbDoc(kb, given), /already exists/);
});

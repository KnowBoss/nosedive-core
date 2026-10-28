// mint-kb-doc
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { i01a141f869c07c4da8288927a559c8ae as mintKbDoc } from "./i01a141f869c07c4da8288927a559c8ae.ts";
import { tempDir } from "../test/harness.ts";

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
	const given = { kind: "root", id: "01a141ff-2539-7f5d-b07d-52a11fd6acb9", name: "my-root", gist: "What my-root holds", title: "my-root" };
	const doc = mintKbDoc(kb, given);
	assert.deepEqual([doc.id, doc.name], [given.id, "my-root"]);
	assert.match(readFileSync(doc.path, "utf8"), /# my-root/);
	assert.throws(() => mintKbDoc(kb, given), /already exists/);
});

test("titles a doc by the name it was given, else by its gist", () => {
	const kb = tempDir("mint-kb-doc-title");
	const named = mintKbDoc(kb, { kind: "memo", gist: "Builds the hero's own code", name: "build-hero" });
	assert.match(readFileSync(named.path, "utf8"), /\n# Build hero\n$/);
	const titled = mintKbDoc(kb, { kind: "memo", gist: "g", name: "n", title: "The title" });
	assert.match(readFileSync(titled.path, "utf8"), /\n# The title\n$/);
});

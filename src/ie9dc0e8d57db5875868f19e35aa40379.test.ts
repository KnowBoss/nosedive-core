// crud <quid> --replace <old> <new>
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { git, ok, run, tempBridge } from "../test/harness.ts";

test("replaces the one place its text occurs, newlines and backslashes kept, each source losing one trailing newline", async () => {
	const bridge = await tempBridge("crud-replace");
	const path = ok(await run(["crud", "core:memo", "a", "note"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	ok(await run(["crud", id, "--body", "-"], bridge, "Keep this.\n\nA path: C:\\old\\dir\nand a line.\n\nKeep that.\n"));
	const front = readFileSync(join(bridge, path), "utf8").split("\n# ")[0];

	writeFileSync(join(bridge, "old.txt"), "C:\\old\\dir\nand a line.\n");
	writeFileSync(join(bridge, "new.txt"), "D:\\new\\dir\n\nin two paragraphs.\n");
	ok(await run(["crud", id, "--replace", "old.txt", "new.txt"], bridge));
	assert.equal(readFileSync(join(bridge, path), "utf8"), `${front}\n# a note\n\nKeep this.\n\nA path: D:\\new\\dir\n\nin two paragraphs.\n\nKeep that.\n`);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), `crud(${id}): updated memo a-note-${id.slice(-6)}`);

	writeFileSync(join(bridge, "empty.txt"), "");
	ok(await run(["crud", id, "--replace", "-", "empty.txt"], bridge, "A path: "));
	assert.equal(readFileSync(join(bridge, path), "utf8"), `${front}\n# a note\n\nKeep this.\n\nD:\\new\\dir\n\nin two paragraphs.\n\nKeep that.\n`, "an empty new text deletes");
});

test("refuses text found nowhere, more than once, or only in the title, and an empty old text or two stdins", async () => {
	const bridge = await tempBridge("crud-replace-refused");
	const path = ok(await run(["crud", "core:memo", "a", "note"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	ok(await run(["crud", id, "--body", "-"], bridge, "twice, twice.\n"));
	const before = readFileSync(join(bridge, path), "utf8");
	writeFileSync(join(bridge, "new.txt"), "x");

	const refusals: [string, string, RegExp][] = [
		["twice", "new.txt", /--replace found its text 2 times under .+'s title; it replaces one place/],
		["absent", "new.txt", /--replace found its text nowhere/],
		["a note", "new.txt", /--replace found its text nowhere/],
		["", "new.txt", /--replace takes text to replace/],
		["x", "-", /--replace can read only one of its texts from stdin/],
	];
	for (const [old, replacement, error] of refusals) {
		const result = await run(["crud", id, "--replace", "-", replacement], bridge, old);
		assert.equal(result.code, 1, old);
		assert.match(result.err, error);
	}
	assert.equal(readFileSync(join(bridge, path), "utf8"), before);
});

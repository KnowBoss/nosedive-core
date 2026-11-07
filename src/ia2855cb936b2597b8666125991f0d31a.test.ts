// crud <quid> --section:<path> <source>...
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { git, ok, run, tempBridge } from "../test/harness.ts";

test("writes sections at their heading paths, in any case, making the headings they lack, beside their siblings, in one commit", async () => {
	const bridge = await tempBridge("crud-section-path");
	const path = ok(await run(["crud", "core:memo", "a", "note"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	const body = () => readFileSync(join(bridge, path), "utf8").split("\n---\n")[1];
	ok(await run(["crud", id, "--body", "-"], bridge, "Intro.\n\n## Notes\n\nKept.\n\n## Log\n\nLast.\n"));

	ok(await run(["crud", id, "--section:Dropped.one", "-"], bridge, "First.\n"));
	assert.equal(body(), "\n# a note\n\nIntro.\n\n## Notes\n\nKept.\n\n## Log\n\nLast.\n\n## Dropped\n\n### one\n\nFirst.\n");

	writeFileSync(join(bridge, "notes.md"), "Rewritten.\n");
	const before = git(["rev-parse", "HEAD"], bridge);
	ok(await run(["crud", id, "--section:dropped.two", "-", "--section:Notes", "notes.md"], bridge, "Second.\n"));
	assert.equal(body(), "\n# a note\n\nIntro.\n\n## Notes\n\nRewritten.\n\n## Log\n\nLast.\n\n## Dropped\n\n### one\n\nFirst.\n\n### two\n\nSecond.\n");
	assert.equal(git(["rev-list", "--count", `${before}..HEAD`], bridge), "1");

	ok(await run(["crud", id, "--section:dropped.one", "-"], bridge, ""));
	assert.equal(body(), "\n# a note\n\nIntro.\n\n## Notes\n\nRewritten.\n\n## Log\n\nLast.\n\n## Dropped\n\n### two\n\nSecond.\n", "an empty source removes it");
});

test("refuses two sources from stdin, and a path with an empty heading", async () => {
	const bridge = await tempBridge("crud-section-path-refused");
	const id = ok(await run(["crud", "core:memo", "a", "note"], bridge)).replace(/^.*\/|\.md$/g, "");
	assert.match((await run(["crud", id, "--section:a", "-", "--section:b", "-"], bridge, "x\n")).err, /only one source can be read from stdin/);
	assert.match((await run(["crud", id, "--section:a..b", "-"], bridge, "x\n")).err, /--section:a\.\.b names an empty heading/);
});

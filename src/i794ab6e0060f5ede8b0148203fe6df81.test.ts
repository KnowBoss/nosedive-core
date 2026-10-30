// crud <quid> --section <heading> <source>
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ok, run, tempBridge } from "../test/harness.ts";

test("appends a section, replaces it in place, and removes it on an empty source", async () => {
	const bridge = await tempBridge("crud-section");
	const path = ok(await run(["crud", "core:memo", "a", "note"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	const body = () => readFileSync(join(bridge, path), "utf8").split("\n---\n")[1];
	ok(await run(["crud", id, "--body", "-"], bridge, "Intro.\n\n## Notes\n\nKept.\n"));

	ok(await run(["crud", id, "--section", "Log 1", "-"], bridge, "First.\n"));
	assert.equal(body(), "\n# a note\n\nIntro.\n\n## Notes\n\nKept.\n\n## Log 1\n\nFirst.\n");

	ok(await run(["crud", id, "--section", "Notes", "-"], bridge, "Rewritten.\n"));
	assert.equal(body(), "\n# a note\n\nIntro.\n\n## Notes\n\nRewritten.\n\n## Log 1\n\nFirst.\n");

	ok(await run(["crud", id, "--section", "Notes", "-"], bridge, ""));
	assert.equal(body(), "\n# a note\n\nIntro.\n\n## Log 1\n\nFirst.\n");
});

test("refuses to remove a section the doc does not have", async () => {
	const bridge = await tempBridge("crud-section-missing");
	const id = ok(await run(["crud", "core:memo", "a", "note"], bridge)).replace(/^.*\/|\.md$/g, "");
	const result = await run(["crud", id, "--section", "Nope", "-"], bridge, "");
	assert.equal(result.code, 1);
	assert.match(result.err, /has no ## Nope section to remove/);
});

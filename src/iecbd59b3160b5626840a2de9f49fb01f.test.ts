// crud <quid> --body <source>
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { git, ok, run, tempBridge } from "../test/harness.ts";

test("replaces everything under the title, from stdin or a file, as text", async () => {
	const bridge = await tempBridge("crud-body");
	const path = ok(await run(["crud", "core:memo", "a", "note"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	const front = readFileSync(join(bridge, path), "utf8").split("\n# ")[0];

	ok(await run(["crud", id, "--body", "-"], bridge, "key: not yaml\n\n## Part\n\nMore.\n"));
	assert.equal(readFileSync(join(bridge, path), "utf8"), `${front}\n# a note\n\nkey: not yaml\n\n## Part\n\nMore.\n`);

	writeFileSync(join(bridge, "body.md"), "From a file.\n");
	ok(await run(["crud", id, "--body", "body.md"], bridge));
	assert.equal(readFileSync(join(bridge, path), "utf8"), `${front}\n# a note\n\nFrom a file.\n`);

	ok(await run(["crud", id, "--body", "-"], bridge, ""));
	assert.equal(readFileSync(join(bridge, path), "utf8"), `${front}\n# a note\n`, "an empty source leaves the title");
});

test("refuses a doc with no title", async () => {
	const bridge = await tempBridge("crud-body-untitled");
	const path = ok(await run(["crud", "core:memo", "untitled"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	const text = readFileSync(join(bridge, path), "utf8");
	writeFileSync(join(bridge, path), text.replace("# untitled\n", "Loose text.\n"));
	const result = await run(["crud", id, "--body", "-"], bridge, "New.\n");
	assert.equal(result.code, 1);
	assert.match(result.err, new RegExp(`${id} has no title: set one with \`nosedive crud ${id} --title <title>\` first`));
	assert.match(readFileSync(join(bridge, path), "utf8"), /Loose text\./);
});

test("a source that starts with a # heading sets the title and writes the rest, leaving one title (body-source-title)", async () => {
	const bridge = await tempBridge("crud-body-titled");
	const path = ok(await run(["crud", "core:memo", "a", "note"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	const file = join(bridge, path);
	const front = readFileSync(file, "utf8").split("\n# ")[0];

	ok(await run(["crud", id, "--body", "-"], bridge, "\n\n# a note\n\n\nThe doc whole.\n\n## Part\n\nMore.\n"));
	assert.equal(readFileSync(file, "utf8"), `${front}\n# a note\n\nThe doc whole.\n\n## Part\n\nMore.\n`, "its own title is not doubled");

	ok(await run(["crud", id, "--body", "-"], bridge, "# A better note\r\n\r\nRetitled.\r\n"));
	assert.equal(readFileSync(file, "utf8"), `${front}\n# A better note\n\nRetitled.\n`, "another heading retitles it, a CRLF source's too");
	assert.equal(git(["log", "-1", "--format=%s"], bridge), "crud: body", "named for its flag");

	ok(await run(["crud", id, "--body", "-"], bridge, "Text first.\n\n# Not a title\n"));
	assert.equal(readFileSync(file, "utf8"), `${front}\n# A better note\n\nText first.\n\n# Not a title\n`, "only a heading on the first non-blank line is the title");

	ok(await run(["crud", id, "--body", "-"], bridge, "# Only a title\n"));
	assert.equal(readFileSync(file, "utf8"), `${front}\n# Only a title\n`);

	writeFileSync(file, `${front}\nLoose text.\n`);
	git(["commit", "-qam", "untitled"], bridge);
	ok(await run(["crud", id, "--body", "-"], bridge, "# Titled again\n\nBody.\n"));
	assert.equal(readFileSync(file, "utf8"), `${front}\n# Titled again\n\nBody.\n`, "a doc with no title takes the source's");
});

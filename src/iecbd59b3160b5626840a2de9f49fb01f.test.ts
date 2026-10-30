// crud <quid> --body <source>
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ok, run, tempBridge } from "../test/harness.ts";

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

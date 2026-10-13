// crud <kind> <gist>... [--name <name>]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { git, ok, run, tempBridge } from "./harness.ts";

test("mints a doc named from its gist, and commits it", async () => {
	const bridge = await tempBridge("crud-mint");
	const path = ok(await run(["crud", "memo", "Hello,", "capes", "world!"], bridge));
	const id = path.replace(/^kb\/|\.md$/g, "");
	assert.equal(
		readFileSync(join(bridge, path), "utf8"),
		`---\nkind: memo\nid: ${id}\nname: hello-capes-world-${id.slice(-6)}\ngist: Hello, capes world!\n---\n\n# Hello, capes world!\n`,
	);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), `crud(${id}): created memo hello-capes-world-${id.slice(-6)}`);
	assert.equal(git(["status", "--porcelain"], bridge), "");
});

test("--name names the doc, in any position", async () => {
	const bridge = await tempBridge("crud-mint-name");
	const path = ok(await run(["crud", "--name", "my-note", "memo", "a", "gist"], bridge));
	assert.match(readFileSync(join(bridge, path), "utf8"), /\nname: my-note\n/);
});

test("refuses outside a bridge, and a kind that is not a slug", async () => {
	const bridge = await tempBridge("crud-mint-refuse");
	const badKind = await run(["crud", "Memo", "a", "gist"], bridge);
	assert.equal(badKind.code, 1);
	assert.match(badKind.err, /kind must be lowercase/);
	const outside = await run(["crud", "memo", "a", "gist"], join(bridge, ".."));
	assert.equal(outside.code, 1);
	assert.match(outside.err, /not in a bridge: run `nosedive seed` first/);
});

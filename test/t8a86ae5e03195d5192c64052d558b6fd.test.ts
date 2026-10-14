// crud <kind> <gist>... [--name <name>]
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { checkedOut, git, ok, run, tempBridge } from "./harness.ts";

test("mints a doc named from its gist, and commits it", async () => {
	const bridge = await tempBridge("crud-mint");
	const path = ok(await run(["crud", "memo", "Hello,", "capes", "world!"], bridge));
	const id = path.replace(/^kb\/|\.md$/g, "");
	assert.equal(
		readFileSync(join(bridge, path), "utf8"),
		`---\nkind: memo\nid: ${id}\nname: hello-capes-world-${id.slice(-6)}\ngist: "Hello, capes world!"\n---\n\n# Hello, capes world!\n`,
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

test("<repo>:<kind> mints into that repo's checkout in the workspace, and commits there", async () => {
	const bridge = await tempBridge("crud-mint-repo");
	const repo = checkedOut(bridge, "other");
	const path = ok(await run(["crud", "other:memo", "over", "there"], bridge));
	assert.match(path, /^workspace\/other\/kb\/[0-9a-f-]{36}\.md$/);
	assert.match(git(["log", "-1", "--format=%s"], repo), /^crud\(\S+\): created memo over-there-/);
	assert.equal(git(["status", "--porcelain"], bridge), "", "the workspace is ignored");
	const missing = await run(["crud", "elsewhere:memo", "x"], bridge);
	assert.equal(missing.code, 1);
	assert.match(missing.err, /elsewhere is not checked out at workspace\/elsewhere/);
});

test("checks the kind: warns when nothing declares it, refuses a schema an empty meta breaks", async () => {
	const bridge = await tempBridge("crud-mint-kinds");
	const undeclared = await run(["crud", "feat", "a", "feat"], bridge);
	assert.equal(undeclared.code, 0);
	assert.match(undeclared.err, /no kind feat is declared here; its meta is not checked/);
	writeFileSync(
		join(bridge, "kb", "task-kind.md"),
		"---\nkind: kind\nid: k\nname: task\nmeta:\n  schema:\n    type: object\n    additionalProperties: false\n    required: [owner]\n    properties:\n      owner: {type: string}\n---\n",
	);
	const refused = await run(["crud", "task", "a", "task"], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /meta does not fit kind task:\n {2}meta must have required property 'owner'/);
});

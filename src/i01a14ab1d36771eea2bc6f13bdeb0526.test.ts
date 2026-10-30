// edit-kb-docs
import assert from "node:assert/strict";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "./i01a133588bcc7f8bae725ff70d8f6800.ts";
import { i01a14ab1d36771eea2bc6f13bdeb0526 as editKbDocs } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { checkedOut, git, ok, run, tempBridge, tempDir, kbOf } from "../test/harness.ts";

const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");
const WORKSPACE_DOC = "01a14ab4-cb92-7dba-bd33-79535603579d";
const UNTRACKED = "01a14ab4-ce62-7712-b43f-3045d0a1fa4d";

test("commits each repo's changed docs once, and skips a doc that ends unchanged", async () => {
	const bridge = await tempBridge("edit-docs");
	const a = ok(await run(["crud", "core:memo", "a"], bridge));
	const b = ok(await run(["crud", "core:memo", "b"], bridge));
	const c = ok(await run(["crud", "core:memo", "c"], bridge));
	const repo = checkedOut(bridge, "other");
	const inRepo = `kb/${WORKSPACE_DOC}.md`;
	writeFileSync(join(repo, inRepo), `---\nkind: memo\nid: ${WORKSPACE_DOC}\nname: far\n---\n`);
	git(["add", inRepo], repo);
	git(["commit", "-qm", "doc"], repo);
	const bridgeHead = git(["rev-parse", "HEAD"], bridge);

	const edit = editKbDocs(bridge);
	assert.equal(edit.doc(idOf(a)), edit.doc(idOf(a)), "a doc is found once");
	updateKbDocField(edit, idOf(a), "gist", () => "first");
	updateKbDocField(edit, idOf(b), "gist", () => "second");
	updateKbDocField(edit, idOf(c), "gist", (gist) => gist);
	updateKbDocField(edit, WORKSPACE_DOC, "gist", () => "far away");
	assert.deepEqual(edit.commit().sort(), [a, b, c, `workspace/other/${inRepo}`].sort());

	assert.equal(git(["log", "--format=%s", `${bridgeHead}..HEAD`], bridge), "crud: updated 2 docs");
	assert.equal(git(["show", "--name-only", "--format=", "HEAD"], bridge).split("\n").sort().join("\n"), [a, b].sort().join("\n"));
	assert.equal(git(["log", "-1", "--format=%s"], repo), `crud(${WORKSPACE_DOC}): updated memo far`);
	assert.match(readFileSync(join(repo, inRepo), "utf8"), /\ngist: far away\n/);
});

test("refuses a doc git does not track, before anything is written", async () => {
	const bridge = await tempBridge("edit-untracked");
	const path = join(kbOf(bridge), `${UNTRACKED}.md`);
	const text = `---\nkind: memo\nid: ${UNTRACKED}\nname: local\n---\n`;
	writeFileSync(path, text);
	appendFileSync(join(bridge, ".git", "info", "exclude"), `kb/${UNTRACKED}.md\n`);
	assert.throws(() => editKbDocs(bridge).doc(UNTRACKED), new RegExp(`${UNTRACKED} is not tracked by git in .+, so crud does not edit it`));

	const result = await run(["crud", UNTRACKED, "--gist", "changed"], bridge);
	assert.equal(result.code, 1);
	assert.match(result.err, /is not tracked by git/);
	assert.equal(readFileSync(path, "utf8"), text);
	ok(await run(["crud", UNTRACKED], bridge));
});

test("refuses outside a bridge and for a missing doc", async () => {
	assert.throws(() => editKbDocs(tempDir("edit-none")), /not in a bridge/);
	const bridge = await tempBridge("edit-missing");
	assert.throws(() => editKbDocs(bridge).doc(UNTRACKED), new RegExp(`no doc ${UNTRACKED} in the bridge or its workspace`));
});

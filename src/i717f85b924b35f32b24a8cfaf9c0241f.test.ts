// crud --drop <quid> [--hard]
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { declareDurable, declareKinds, git, ok, run, tempBridge, kbPath } from "../test/harness.ts";

const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");

/** A goal hanging from a parent goal, linked `child.feat` from it and `ideas.feat` from a memo. */
async function hung(label: string) {
	const bridge = await tempBridge(label);
	await declareKinds(bridge, "goal");
	const parent = ok(await run(["crud", "goal", "parent"], bridge));
	const child = ok(await run(["crud", "goal", "passing", "work"], bridge));
	ok(await run(["crud", idOf(parent), "--links", "-"], bridge, `${kbPath(bridge, idOf(child))}:\n  rel: child.feat\n`));
	const note = ok(await run(["crud", "core:memo", "a", "note"], bridge));
	ok(await run(["crud", idOf(note), "--links", "-"], bridge, `${kbPath(bridge, idOf(child))}:\n  rel: ideas.feat\n`));
	return { bridge, parent, child, note, read: (path: string) => readFileSync(join(bridge, path), "utf8") };
}

test("refuses a doc its parent records nothing of, or only its gist, saying what to read and write, and edits nothing", async () => {
	const { bridge, parent, child } = await hung("crud-drop-unrecorded");
	const head = git(["rev-parse", "HEAD"], bridge);
	const refused = await run(["crud", "--drop", idOf(child)], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /goal passing-work-\w{6} was not dropped:\n {2}goal parent-\w{6}, memo a-note-\w{6} record nothing of what it held: read \S+, check it against when it is dropped/);
	assert.match(refused.err, new RegExp(`\`nosedive crud ${idOf(parent)} --section:Dropped\\.${idOf(child)} -\``));
	assert.match(refused.err, /\n\nA goal is dropped when:\n {2}A goal is dropped once it is done\.$/, "its kind's Drop when");
	assert.equal(git(["rev-parse", "HEAD"], bridge), head);

	ok(await run(["crud", idOf(parent), `--section:Dropped.${idOf(child)}`, "-"], bridge, "passing work\n"));
	assert.match((await run(["crud", "--drop", idOf(child)], bridge)).err, /record nothing of what it held/, "its gist is no record");
});

test("drops a doc a parent records, with every .feat link to it, in one commit, past workspace repos with no kb", async () => {
	const { bridge, parent, child, note, read } = await hung("crud-drop-recorded");
	mkdirSync(join(bridge, "workspace", "no-kb"), { recursive: true });
	ok(await run(["crud", idOf(parent), `--section:Dropped.${idOf(child)}`, "-"], bridge, "Proved the work passes; its lessons are on the parent.\n"));
	const head = git(["rev-parse", "HEAD"], bridge);
	assert.equal(ok(await run(["crud", "--drop", idOf(child)], bridge)), child);
	assert.equal(existsSync(join(bridge, child)), false);
	assert.doesNotMatch(read(parent), new RegExp(`${idOf(child)}\\.md`), "the parent's link goes");
	assert.match(read(parent), new RegExp(`\n## Dropped\n\n### ${idOf(child)}\n\nProved the work passes`), "its record stays");
	assert.doesNotMatch(read(note), /links:/, "the memo's only link goes, and its links with it");
	assert.equal(git(["rev-list", "--count", `${head}..HEAD`], bridge), "1");
	assert.equal(git(["status", "--porcelain"], bridge), "");
});

test("refuses a doc with a child, a link other than the tree's, or a body linking it, naming each", async () => {
	const { bridge, parent, child, note } = await hung("crud-drop-blocked");
	ok(await run(["crud", idOf(child), "--links", "-"], bridge, `${kbPath(bridge, idOf(parent))}:\n  rel: parent.feat\n`));
	ok(await run(["crud", idOf(note), "--links", "-"], bridge, `${kbPath(bridge, idOf(parent))}:\n  rel: see\n`));
	const linker = ok(await run(["crud", "core:memo", "a", "linker"], bridge));
	ok(await run(["crud", idOf(linker), "--body", "-"], bridge, `See [the parent](${idOf(parent)}.md), and ${idOf(parent)} bare.\n`));
	const refused = await run(["crud", "--drop", idOf(parent), "--sure"], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, new RegExp(`\n {2}${child} hangs under it: drop it first`));
	assert.match(refused.err, new RegExp(`\n {2}${note} links it as see: remove that link first`));
	assert.match(refused.err, new RegExp(`\n {2}${linker} links it in its body: remove that link first`));
	assert.equal(refused.err.split(linker).length - 1, 1, "a bare id is no link");
});

test("refuses a root its config lists", async () => {
	const bridge = await tempBridge("crud-drop-root");
	await declareKinds(bridge, "goal");
	const root = readRepoConfig(bridge)!.root!;
	const refused = await run(["crud", "--drop", root, "--hard"], bridge);
	assert.match(refused.err, /\.nosedive\/config\.yaml lists it among its roots/);
});

test("keeps a durable doc unless --hard", async () => {
	const bridge = await tempBridge("crud-drop-durable");
	await declareDurable(bridge, "keep");
	const path = ok(await run(["crud", "keep", "a", "note"], bridge));
	const refused = await run(["crud", "--drop", idOf(path), "--sure"], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /keep a-note-\w{6} is durable: its file keeps it findable by id, so it was not dropped; --hard drops it anyway/);
	assert.equal(existsSync(join(bridge, path)), true);
	ok(await run(["crud", "--drop", idOf(path), "--sure", "--hard"], bridge));
	assert.equal(existsSync(join(bridge, path)), false);
});

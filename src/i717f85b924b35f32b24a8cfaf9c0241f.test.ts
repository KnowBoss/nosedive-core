// crud --drop <quid> [--hard]
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { declareDurable, declareHanging, declareKinds, git, ok, run, tempBridge, kbPath } from "../test/harness.ts";

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
	const dropped = ok(await run(["crud", "--drop", idOf(child)], bridge)).split("\n");
	assert.equal(dropped[0], child);
	assert.deepEqual(dropped.slice(1).map((line) => line.replace(/^unlinked \S+: /, "")), ["child.feat", "ideas.feat"], "then each link taken");
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

test("drops a doc its root's rendered tree lists, rendering the tree again in the drop's commit (drops-rerender-tree)", async () => {
	const { bridge, parent, child, read } = await hung("crud-drop-rendered");
	const root = readRepoConfig(bridge)!.root!;
	ok(await run(["crud", root, "--links", "-"], bridge, `${kbPath(bridge, idOf(parent))}:\n  rel: ideas.feat\n`));
	ok(await run(["seed"], bridge));
	const rootPath = kbPath(bridge, root);
	assert.match(read(rootPath), new RegExp(`${idOf(child)}\.md`), "the tree lists the child");
	ok(await run(["crud", idOf(parent), `--section:Dropped.${idOf(child)}`, "-"], bridge, "Done; its lessons are on the parent.\n"));
	const head = git(["rev-parse", "HEAD"], bridge);
	ok(await run(["crud", "--drop", idOf(child)], bridge));
	assert.doesNotMatch(read(rootPath), new RegExp(idOf(child)), "gone from the tree");
	assert.match(read(rootPath), new RegExp(`${idOf(parent)}\.md`), "its parent still listed");
	assert.equal(git(["rev-list", "--count", `${head}..HEAD`], bridge), "1");
	assert.equal(git(["status", "--porcelain"], bridge), "");
});

test("refuses a doc the body of a root linking no .feat links, leaving that body as its author wrote it", async () => {
	const { bridge, parent, child, read } = await hung("crud-drop-unrendered");
	const root = readRepoConfig(bridge)!.root!;
	const rootPath = kbPath(bridge, root);
	ok(await run(["crud", root, "--body", "-"], bridge, `\n# Show\n\nIts author's words, and [the child](${idOf(child)}.md).\n`));
	const body = read(rootPath);
	ok(await run(["crud", idOf(parent), `--section:Dropped.${idOf(child)}`, "-"], bridge, "Done; its lessons are on the parent.\n"));
	const head = git(["rev-parse", "HEAD"], bridge);
	const refused = await run(["crud", "--drop", idOf(child)], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, new RegExp(`\n {2}${rootPath} links it in its body: remove that link first`));
	assert.equal(read(rootPath), body);
	assert.equal(git(["rev-parse", "HEAD"], bridge), head);
});

/** A feat the root reaches, a `plan` of a kind naming `planned.dive` in meta.next that the feat links by it, and a memo linking the plan by a rel the kind does not name. */
async function planned(label: string) {
	const bridge = await tempBridge(label);
	await declareHanging(bridge, "plan", "planned.dive");
	const root = readRepoConfig(bridge)!.root!;
	const feat = ok(await run(["crud", "core:memo", "the feat", "--name", "feat"], bridge));
	const plan = ok(await run(["crud", "plan", "a plan"], bridge));
	const note = ok(await run(["crud", "core:memo", "a note"], bridge));
	ok(await run(["crud", root, "--links", "-"], bridge, `${feat}: {rel: work.feat}\n`));
	ok(await run(["crud", idOf(feat), "--links", "-"], bridge, `${plan}: {rel: planned.dive}\n`));
	return { bridge, feat, plan, note, read: (path: string) => readFileSync(join(bridge, path), "utf8") };
}

test("takes a doc from the doc linking it by a rel its kind names in meta.next, as it lists it, after that doc records it (drop-takes-declared-links)", async () => {
	const { bridge, feat, plan, read } = await planned("crud-drop-declared");
	assert.match(ok(await run(["next"], bridge)), new RegExp(`feat {2}${feat}\\n {2}plan a-plan-\\w{6} {2}${plan}`), "next lists it under the feat");
	const head = git(["rev-parse", "HEAD"], bridge);
	const refused = await run(["crud", "--drop", idOf(plan)], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /plan a-plan-\w{6} was not dropped:\n {2}memo feat records nothing of what it held/);
	assert.doesNotMatch(refused.err, /hangs from no doc|--sure/, "it hangs from the feat, so no --sure");
	assert.equal(git(["rev-parse", "HEAD"], bridge), head);

	ok(await run(["crud", idOf(feat), `--section:Dropped.${idOf(plan)}`, "-"], bridge, "Planned and carried out; the result is on the feat.\n"));
	assert.equal(ok(await run(["crud", "--drop", idOf(plan)], bridge)), `${plan}\nunlinked ${feat}: planned.dive`);
	assert.equal(existsSync(join(bridge, plan)), false);
	assert.doesNotMatch(read(feat), new RegExp(`${idOf(plan)}\\.md`), "the feat's link goes");
	assert.match(read(feat), new RegExp(`### ${idOf(plan)}\\n\\nPlanned and carried out`), "its record stays");
	assert.equal(git(["rev-list", "--count", `${head}..HEAD`], bridge), "2", "the record, then the drop with the link");
	assert.equal(git(["status", "--porcelain"], bridge), "");
});

test("still refuses a doc a link by a rel its kind does not name holds, naming it", async () => {
	const { bridge, feat, plan, note } = await planned("crud-drop-undeclared");
	ok(await run(["crud", idOf(feat), `--section:Dropped.${idOf(plan)}`, "-"], bridge, "Planned and carried out.\n"));
	ok(await run(["crud", idOf(note), "--links", "-"], bridge, `${plan}: {rel: seen.dive}\n`));
	const refused = await run(["crud", "--drop", idOf(plan)], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, new RegExp(`\\n {2}${note} links it as seen\\.dive: remove that link first`));
	assert.equal(existsSync(join(bridge, plan)), true);
});

test("prints each link it removed after the dropped path, as unlinked <holder path>: <rel>", async () => {
	const { bridge, parent, child, note } = await hung("crud-drop-unlinked");
	ok(await run(["crud", idOf(parent), `--section:Dropped.${idOf(child)}`, "-"], bridge, "Proved the work passes.\n"));
	const lines = ok(await run(["crud", "--drop", idOf(child)], bridge)).split("\n");
	assert.equal(lines[0], child);
	assert.deepEqual(lines.slice(1).sort(), [`unlinked ${note}: ideas.feat`, `unlinked ${parent}: child.feat`].sort());
});

test("still refuses a durable kind's declared rel, which names no hanging (drop-takes-declared-links)", async () => {
	const bridge = await tempBridge("crud-drop-durable-declared");
	ok(await run(["crud", "core:kind", "a keep", "--name", "keep", "--meta", "-"], bridge, "schema:\n  type: object\n  additionalProperties: true\nnext:\n  - kept.dive\n"));
	const feat = ok(await run(["crud", "core:memo", "the feat", "--name", "feat"], bridge));
	const keep = ok(await run(["crud", "keep", "a keep"], bridge));
	ok(await run(["crud", idOf(feat), "--links", "-"], bridge, `${keep}: {rel: kept.dive}\n`));
	const refused = await run(["crud", "--drop", idOf(keep), "--sure", "--hard"], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, new RegExp(`${feat} links it as kept\.dive: remove that link first`));
	assert.equal(existsSync(join(bridge, keep)), true);
});

test("takes a doc from a root that is its only holder by a declared rel, printing the root's path (drop-takes-declared-links)", async () => {
	const bridge = await tempBridge("crud-drop-root-holder");
	await declareHanging(bridge, "plan", "planned.dive");
	const root = readRepoConfig(bridge)!.root!;
	const rootPath = kbPath(bridge, root);
	const plan = ok(await run(["crud", "plan", "a plan"], bridge));
	ok(await run(["crud", root, "--links", "-"], bridge, `${plan}: {rel: planned.dive}\n`));
	ok(await run(["crud", root, `--section:Dropped.${idOf(plan)}`, "-"], bridge, "Carried out.\n"));
	assert.equal(ok(await run(["crud", "--drop", idOf(plan)], bridge)), `${plan}\nunlinked ${rootPath}: planned.dive`);
	assert.doesNotMatch(readFileSync(join(bridge, rootPath), "utf8"), /planned\.dive/);
	assert.equal(git(["status", "--porcelain"], bridge), "");
});

test("takes a doc's link from a holder next does not walk, the record going on it (drop-takes-declared-links)", async () => {
	const { bridge, plan, read } = await planned("crud-drop-unwalked");
	const stray = ok(await run(["crud", "core:memo", "a stray"], bridge));
	ok(await run(["crud", idOf(stray), "--links", "-"], bridge, `${plan}: {rel: planned.dive}\n`));
	assert.doesNotMatch(ok(await run(["next"], bridge)), new RegExp(stray), "no root reaches it");
	ok(await run(["crud", idOf(stray), `--section:Dropped.${idOf(plan)}`, "-"], bridge, "Carried out.\n"));
	const lines = ok(await run(["crud", "--drop", idOf(plan)], bridge)).split("\n");
	assert.deepEqual(lines, [plan, ...lines.slice(1)]);
	assert.ok(lines.includes(`unlinked ${stray}: planned.dive`));
	assert.doesNotMatch(read(stray), /links:/);
});

test("one holder linking a doc by a .feat rel and a declared rel hangs it once, printing both links (drop-takes-declared-links)", async () => {
	const { bridge, feat, plan, read } = await planned("crud-drop-both");
	// crud keeps one link per target, so the second goes in by hand.
	writeFileSync(join(bridge, feat), read(feat).replace("      rel: planned.dive\n", `      rel: planned.dive\n  - ${plan}:\n      rel: tracked.feat\n`));
	git(["commit", "-qam", "a second link"], bridge);
	assert.equal(read(feat).match(/rel: (planned\.dive|tracked\.feat)/g)!.length, 2, "both links are on the feat");
	ok(await run(["crud", idOf(feat), `--section:Dropped.${idOf(plan)}`, "-"], bridge, "Carried out.\n"));
	const lines = ok(await run(["crud", "--drop", idOf(plan)], bridge)).split("\n");
	assert.equal(lines[0], plan);
	assert.deepEqual(lines.slice(1).sort(), [`unlinked ${feat}: planned.dive`, `unlinked ${feat}: tracked.feat`]);
	assert.doesNotMatch(read(feat), /links:/);
});

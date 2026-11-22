// edit-kb-docs
import assert from "node:assert/strict";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { test } from "node:test";
import { i01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "./i01a133588bcc7f8bae725ff70d8f6800.ts";
import { i01a14ab1d36771eea2bc6f13bdeb0526 as editKbDocs } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { checkedOut, declareDurable, declareKinds, git, ok, run, tempBridge, tempDir, kbOf, kbPath } from "../test/harness.ts";

const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");
const WORKSPACE_DOC = "01a14ab4-cb92-7dba-bd33-79535603579d";
const UNTRACKED = "01a14ab4-ce62-7712-b43f-3045d0a1fa4d";
const hooksOf = (bridge: string) => {
	const configured = git(["config", "--get", "core.hooksPath"], bridge);
	return isAbsolute(configured) ? configured : join(bridge, configured || ".git/hooks");
};

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

	const edit = editKbDocs(bridge, "test");
	assert.equal(edit.doc(idOf(a)), edit.doc(idOf(a)), "a doc is found once");
	updateKbDocField(edit, idOf(a), "gist", () => "first");
	updateKbDocField(edit, idOf(b), "gist", () => "second");
	updateKbDocField(edit, idOf(c), "gist", (gist) => gist);
	updateKbDocField(edit, WORKSPACE_DOC, "gist", () => "far away");
	assert.deepEqual(edit.commit().sort(), [a, b, c, `workspace/other/${inRepo}`].sort());

	assert.equal(git(["log", "--format=%s", `${bridgeHead}..HEAD`], bridge), "crud: edit");
	assert.equal(git(["show", "--name-only", "--format=", "HEAD"], bridge).split("\n").sort().join("\n"), [a, b].sort().join("\n"));
	assert.equal(git(["log", "-1", "--format=%s"], repo), "crud: edit");
	assert.match(readFileSync(join(repo, inRepo), "utf8"), /\ngist: far away\n/);
});

test("an editor save after the doc is read never enters the commit and survives on disk", async () => {
	const bridge = await tempBridge("edit-docs-save-before-commit");
	const relative = ok(await run(["crud", "core:memo", "a"], bridge));
	const path = join(bridge, relative);
	const edit = editKbDocs(bridge, "test", undefined, () => {});
	updateKbDocField(edit, idOf(relative), "gist", () => "nosedive's exact edit");
	writeFileSync(join(hooksOf(bridge), "post-index-change"), `#!/bin/sh\nprintf 'editor save\\n' > '${path.replace(/\\/g, "/")}'\n`, { mode: 0o755 });

	edit.commit();

	assert.match(git(["show", `HEAD:${relative}`], bridge), /gist: ["']?nosedive's exact edit/);
	assert.doesNotMatch(git(["show", `HEAD:${relative}`], bridge), /editor save/);
	assert.equal(readFileSync(path, "utf8"), "editor save\n");
	assert.equal(git(["diff", "--cached", "--name-only", "--", relative], bridge), relative, "the index was left as the user had it, so it differs from the commit");
	assert.equal(git(["diff", "--name-only", "--", relative], bridge), relative);
});

test("an editor save just before the working-file update survives after the exact commit", async () => {
	const bridge = await tempBridge("edit-docs-save-before-checkout");
	const relative = ok(await run(["crud", "core:memo", "a"], bridge));
	const path = join(bridge, relative);
	const warnings: string[] = [];
	const edit = editKbDocs(bridge, "test", undefined, (warning) => warnings.push(warning));
	updateKbDocField(edit, idOf(relative), "gist", () => "nosedive's exact edit");
	writeFileSync(join(hooksOf(bridge), "reference-transaction"), `#!/bin/sh\n[ "$1" = committed ] || exit 0\nprintf 'editor save\\n' > '${path.replace(/\\/g, "/")}'\n`, { mode: 0o755 });

	edit.commit();

	assert.match(git(["show", `HEAD:${relative}`], bridge), /gist: ["']?nosedive's exact edit/);
	assert.equal(readFileSync(path, "utf8"), "editor save\n");
	assert.equal(git(["diff", "--cached", "--name-only", "--", relative], bridge), relative, "the index was left as the user had it, so it differs from the commit");
	assert.equal(git(["diff", "--name-only", "--", relative], bridge), relative);
	assert.match(warnings.join("\n"), /committed.*left.*file.*alone/i);
});

test("a version the user staged, with the file changed since, is never replaced in the index by the edit", async () => {
	const bridge = await tempBridge("edit-docs-staged-c");
	const relative = ok(await run(["crud", "core:memo", "a"], bridge));
	const path = join(bridge, relative);
	const base = readFileSync(path, "utf8");
	writeFileSync(path, `${base}\nstaged C\n`);
	git(["add", relative], bridge);
	const staged = git(["rev-parse", `:${relative}`], bridge);
	writeFileSync(path, `${base}\nworking B\n`);
	const warnings: string[] = [];
	const edit = editKbDocs(bridge, "test", undefined, (warning) => warnings.push(warning));
	updateKbDocField(edit, idOf(relative), "gist", () => "nosedive's exact edit");

	edit.commit();

	assert.equal(git(["rev-parse", `:${relative}`], bridge), staged, "the staged version is still staged");
	assert.match(readFileSync(path, "utf8"), /working B/, "the file is the user's");
	assert.match(git(["show", `HEAD:${relative}`], bridge), /nosedive's exact edit/);
	assert.match(warnings.join("\n"), /committed.*left.*alone/i);
});

test("a version staged while the working-file update is refused is not reset to the commit", async () => {
	const bridge = await tempBridge("edit-docs-staged-during");
	const relative = ok(await run(["crud", "core:memo", "a"], bridge));
	const path = join(bridge, relative).replace(/\\/g, "/");
	const root = bridge.replace(/\\/g, "/");
	const edit = editKbDocs(bridge, "test", undefined, () => {});
	updateKbDocField(edit, idOf(relative), "gist", () => "nosedive's exact edit");
	writeFileSync(join(hooksOf(bridge), "reference-transaction"), `#!/bin/sh\n[ "$1" = committed ] || exit 0\nunset GIT_DIR GIT_INDEX_FILE GIT_WORK_TREE\nprintf 'staged C\\n' > '${path}'\ngit -C '${root}' add '${relative}'\nprintf 'working B\\n' > '${path}'\n`, { mode: 0o755 });

	edit.commit();

	assert.equal(git(["show", `:${relative}`], bridge), "staged C", "the staged version survives");
	assert.equal(readFileSync(join(bridge, relative), "utf8"), "working B\n");
});

test("pass never edits the real index by hand: git's read-tree is the only thing that updates it and the files", () => {
	const text = readFileSync(new URL("./i01a14ab1d36771eea2bc6f13bdeb0526.ts", import.meta.url), "utf8");
	assert.doesNotMatch(text, /update-index|ls-files", "-s"|"reset"|--cacheinfo/);
	const plan = readFileSync(new URL("./i01a1ffce2ea27db19c84f1fec56c9a3d.ts", import.meta.url), "utf8");
	assert.doesNotMatch(plan, /\["reset"/);
});

test("an intent-to-add entry the user made for an empty or new doc is not taken for nosedive's", async () => {
	const bridge = await tempBridge("edit-docs-user-ita");
	const relative = ok(await run(["crud", "core:memo", "a"], bridge));
	const user = join(kbOf(bridge), `${UNTRACKED}.md`).slice(bridge.length + 1).replace(/\\/g, "/");
	writeFileSync(join(bridge, user), `---\nkind: memo\nid: ${UNTRACKED}\nname: theirs\ngist: "theirs"\n---\n\n# Theirs\n`);
	git(["add", "-N", user], bridge);
	const before = git(["ls-files", "-s", "--", user], bridge);
	const warnings: string[] = [];
	const edit = editKbDocs(bridge, "test", undefined, (warning) => warnings.push(warning));
	updateKbDocField(edit, UNTRACKED, "gist", () => "nosedive's edit");
	const disk = readFileSync(join(bridge, user), "utf8");

	edit.commit();

	assert.equal(git(["ls-files", "-s", "--", user], bridge), before, "the user's index entry is as it was");
	assert.equal(readFileSync(join(bridge, user), "utf8"), disk, "and so is the file");
	assert.match(git(["show", `HEAD:${user}`], bridge), /nosedive's edit/);
	assert.match(warnings.join("\n"), /committed.*left.*alone/i);
	assert.ok(relative);
});

test("a mode change the user staged is never lost to the edit", async () => {
	const bridge = await tempBridge("edit-docs-staged-mode");
	const relative = ok(await run(["crud", "core:memo", "a"], bridge));
	git(["update-index", "--chmod=+x", relative], bridge);
	const before = git(["ls-files", "-s", "--", relative], bridge);
	assert.match(before, /^100755 /);
	const warnings: string[] = [];
	const edit = editKbDocs(bridge, "test", undefined, (warning) => warnings.push(warning));
	updateKbDocField(edit, idOf(relative), "gist", () => "nosedive's exact edit");

	edit.commit();

	assert.match(git(["ls-files", "-s", "--", relative], bridge), /^100755 /, "the staged mode change survives");
	assert.match(git(["show", `HEAD:${relative}`], bridge), /nosedive's exact edit/);
	assert.match(warnings.join("\n"), /committed.*left.*alone/i);
});

import { readdirSync } from "node:fs";
import { noteMinted } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a141f869c07c4da8288927a559c8ae as mintKbDoc } from "./i01a141f869c07c4da8288927a559c8ae.ts";

test("a minted doc's staged copy is never deleted once its bytes changed, and a restore never replaces a file", async () => {
	const bridge = await tempBridge("edit-docs-minted-late");
	const dir = kbOf(bridge);
	const made = mintKbDoc(dir, { kind: "memo", gist: "minted", name: "minted" });
	noteMinted(made.path);
	const edit = editKbDocs(bridge, "test", undefined, () => {});
	updateKbDocField(edit, made.id, "gist", () => "edited");
	const late = join(dir, ".nosedive-stage-*", "doc").replace(/\\/g, "/");
	writeFileSync(join(hooksOf(bridge), "post-index-change"), `#!/bin/sh\nfor f in ${late}; do [ -f "$f" ] && printf 'late write through an open handle\\n' > "$f"; done\nexit 0\n`, { mode: 0o755 });
	const warnings: string[] = [];
	const again = editKbDocs(bridge, "test", undefined, (warning) => warnings.push(warning));
	updateKbDocField(again, made.id, "gist", () => "edited");

	again.commit();

	const kept = readdirSync(dir).filter((name) => name.startsWith(".nosedive-stage-"));
	assert.equal(kept.length, 1, "the staged copy was kept");
	assert.equal(readFileSync(join(dir, kept[0]!, "doc"), "utf8"), "late write through an open handle\n");
	assert.match(warnings.join("\n"), /kept in/);
	assert.match(git(["show", `HEAD:${join(dir, `${made.id}.md`).slice(bridge.length + 1).replace(/\\/g, "/")}`], bridge), /edited/);
	void edit;
});

test("restoring a minted doc is exclusive: it never renames over a path", () => {
	const text = readFileSync(new URL("./i01a14ab1d36771eea2bc6f13bdeb0526.ts", import.meta.url), "utf8");
	assert.match(text, /linkSync/);
	assert.doesNotMatch(text, /renameSync\(join\(dir, "doc"\), path\)|renameSync\(held, doc\.path\)/);
});

test("refuses a doc git does not track, before anything is written", async () => {
	const bridge = await tempBridge("edit-untracked");
	const path = join(kbOf(bridge), `${UNTRACKED}.md`);
	const text = `---\nkind: memo\nid: ${UNTRACKED}\nname: local\n---\n`;
	writeFileSync(path, text);
	appendFileSync(join(bridge, ".git", "info", "exclude"), `${kbPath(bridge, UNTRACKED)}\n`);
	assert.throws(() => editKbDocs(bridge, "test").doc(UNTRACKED), new RegExp(`${UNTRACKED} is not tracked by git in .+, so crud does not edit it`));

	const result = await run(["crud", UNTRACKED, "--gist", "changed"], bridge);
	assert.equal(result.code, 1);
	assert.match(result.err, /is not tracked by git/);
	assert.equal(readFileSync(path, "utf8"), text);
	ok(await run(["crud", UNTRACKED], bridge));
});

test("refuses outside a bridge and for a missing doc", async () => {
	assert.throws(() => editKbDocs(tempDir("edit-none"), "test"), /not in a bridge/);
	const bridge = await tempBridge("edit-missing");
	assert.throws(() => editKbDocs(bridge, "test").doc(UNTRACKED), new RegExp(`no doc ${UNTRACKED} in the bridge or its workspace`));
});

test("writes an edited doc in KINGSMETAL order, links last", async () => {
	const bridge = await tempBridge("edit-docs-order");
	const a = ok(await run(["crud", "core:memo", "a"], bridge));
	const path = join(bridge, a);
	const text = readFileSync(path, "utf8");
	const body = text.slice(text.indexOf("\n---\n") + 5);
	writeFileSync(path, `---\nlinks:\n  - kb/x.md:\n      rel: parent.feat\nextra: 1\nmeta:\n  z: 1\n  y: 2\ngist: a\nname: n\nid: ${idOf(a)}\nkind: memo\n---\n${body}`);
	git(["commit", "-qam", "misordered"], bridge);

	const edit = editKbDocs(bridge, "test");
	updateKbDocField(edit, idOf(a), "gist", () => "edited");
	edit.commit();

	const keys = readFileSync(path, "utf8").split("\n").filter((line) => /^[\w-]+:/.test(line)).map((line) => line.split(":")[0]);
	assert.deepEqual(keys, ["kind", "id", "name", "gist", "meta", "extra", "links"]);
	assert.match(readFileSync(path, "utf8"), /meta:\n {2}z: 1\n {2}y: 2\n/);
});

test("writes a doc whose only change is its key order", async () => {
	const bridge = await tempBridge("edit-docs-order-only");
	const a = ok(await run(["crud", "core:memo", "a"], bridge));
	const path = join(bridge, a);
	const text = readFileSync(path, "utf8");
	const body = text.slice(text.indexOf("\n---\n") + 5);
	writeFileSync(path, `---\nx-y: 1\nname: n\nid: ${idOf(a)}\nkind: memo\ngist: g\n---\n${body}`);
	git(["commit", "-qam", "misordered"], bridge);
	const before = git(["rev-parse", "HEAD"], bridge);

	const edit = editKbDocs(bridge, "test");
	updateKbDocField(edit, idOf(a), "gist", (gist) => gist);
	assert.deepEqual(edit.commit(), [a]);

	assert.notEqual(git(["rev-parse", "HEAD"], bridge), before);
	const keys = readFileSync(path, "utf8").split("\n").filter((line) => /^[\w-]+:/.test(line)).map((line) => line.split(":")[0]);
	assert.deepEqual(keys, ["kind", "id", "name", "gist", "x-y"]);
});

/** A hero with a durable kind of its own, `keep`, and its primary root's path. */
async function keepingBridge(label: string): Promise<{ bridge: string; root: string }> {
	const bridge = await tempBridge(label);
	await declareDurable(bridge, "keep");
	const root = /roots:\r?\n {2}- (\S+)/.exec(readFileSync(join(bridge, ".nosedive", "config.yaml"), "utf8"))![1]!;
	return { bridge, root };
}

test("refuses a new .feat link that hangs a durable doc under one that is neither durable nor a root", async () => {
	const { bridge, root } = await keepingBridge("edit-durable-links");
	// A kind of passing work: its Done when makes it not durable.
	const step = ok(await run(["crud", "core:kind", "a step", "--name", "step", "--meta", "-"], bridge, "schema:\n  type: object\n  additionalProperties: true\n"));
	ok(await run(["crud", idOf(step), "--section", "Done when", "-"], bridge, "It is landed.\n"));
	const memo = ok(await run(["crud", "step", "work"], bridge));
	const kept = ok(await run(["crud", "keep", "kept"], bridge));
	const other = ok(await run(["crud", "keep", "other"], bridge));

	const under = await run(["crud", idOf(kept), "--parent", idOf(memo)], bridge);
	assert.equal(under.code, 1);
	assert.match(under.err, /keep kept-\w+ is durable, so it cannot hang under step work-\w+, which is neither durable nor a root/);
	const child = await run(["crud", idOf(memo), "--links", "-"], bridge, `${kept}:\n  rel: child.feat\n`);
	assert.equal(child.code, 1, "a child link down from the memo is refused too");
	assert.doesNotMatch(readFileSync(join(bridge, memo), "utf8"), /child\.feat/, "nothing was written");

	ok(await run(["crud", idOf(kept), "--parent", idOf(other)], bridge));
	ok(await run(["crud", idOf(root.replace(/^.*\//, "")), "--links", "-"], bridge, `${kept}:\n  rel: kept.feat\n`));
	ok(await run(["crud", idOf(memo), "--parent", idOf(kept)], bridge));
});

test("leaves a link the doc held before the edit alone", async () => {
	const { bridge } = await keepingBridge("edit-durable-held");
	const memo = ok(await run(["crud", "core:memo", "work"], bridge));
	const kept = ok(await run(["crud", "keep", "kept"], bridge));
	const path = join(bridge, kept);
	writeFileSync(path, readFileSync(path, "utf8").replace(/\n---\n/, `\nlinks:\n  - ${memo}:\n      rel: parent.feat\n---\n`));
	git(["commit", "-qam", "held"], bridge);
	ok(await run(["crud", idOf(kept), "--gist", "still kept"], bridge));
});

test("refuses a new .spec link from a doc that is not durable, takes one from a durable doc, and lets a spec already linked change its rel (specs-on-durable)", async () => {
	const { bridge } = await keepingBridge("edit-specs-on-durable");
	await declareKinds(bridge, "goal");
	const goal = ok(await run(["crud", "goal", "work"], bridge));
	const memo = ok(await run(["crud", "core:memo", "what", "lasts"], bridge));
	const spec = ok(await run(["crud", "keep", "a", "decision"], bridge));
	const refused = await run(["crud", idOf(goal), "--links", "-"], bridge, `${spec}:\n  rel: closed.spec\n`);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /goal \S+ is not durable, so it cannot hold specs: a spec hangs off the durable doc it shapes, and work links to what it needs \(specs-on-durable\)/);
	assert.doesNotMatch(readFileSync(join(bridge, goal), "utf8"), /closed\.spec/, "nothing was written");
	ok(await run(["crud", idOf(memo), "--links", "-"], bridge, `${spec}:\n  rel: closed.spec\n`));

	// A spec a goal held from before the rule is answered or superseded in place.
	const text = readFileSync(join(bridge, goal), "utf8").replace(/\n---\n/, `\nlinks:\n  - ${spec}:\n      rel: open.spec\n---\n`);
	writeFileSync(join(bridge, goal), text);
	git(["add", goal], bridge);
	git(["commit", "-qm", "an old spec"], bridge);
	ok(await run(["crud", idOf(goal), "--links", "-"], bridge, `${spec}:\n  rel: closed.spec\n`));
});

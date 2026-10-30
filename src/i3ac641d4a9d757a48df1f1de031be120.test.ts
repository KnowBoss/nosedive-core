// crud <quid> --meta <source>
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a147171f057d019118aaa1f269f5fd as findKind, digestOf, versionOf } from "./i01a147171f057d019118aaa1f269f5fd.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { checkedOut, git, gitRepo, ok, run, tempBridge, tempDir } from "../test/harness.ts";

const core: Cape = await sourceCape();

test("merge-patches meta from stdin or a file, changing only that field, and commits", async () => {
	const bridge = await tempBridge("crud-meta");
	const path = ok(await run(["crud", "core:memo", "metered"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	const before = readFileSync(join(bridge, path), "utf8");

	ok(await run(["crud", id, "--meta", "-"], bridge, "owner: dan\nstate: open\n"));
	writeFileSync(join(bridge, "patch.yaml"), "state: null\n");
	ok(await run(["crud", id, "--meta=patch.yaml"], bridge));

	const after = readFileSync(join(bridge, path), "utf8");
	assert.equal(after, before.replace("---\n\n#", "meta:\n  owner: dan\n---\n\n#"));
	assert.equal(git(["log", "-1", "--format=%s"], bridge), `crud(${id}): updated memo metered-${id.slice(-6)}`);
});

test("removes meta when the patch empties it", async () => {
	const bridge = await tempBridge("crud-meta-empty");
	const path = ok(await run(["crud", "core:memo", "brief"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	ok(await run(["crud", id, "--meta", "-"], bridge, "a: 1\n"));
	ok(await run(["crud", id, "--meta", "-"], bridge, "a: null\n"));
	assert.doesNotMatch(readFileSync(join(bridge, path), "utf8"), /meta/);
});

test("refuses a patch that is not a mapping", async () => {
	const bridge = await tempBridge("crud-meta-bad");
	const id = ok(await run(["crud", "core:memo", "x"], bridge)).replace(/^.*\/|\.md$/g, "");
	const result = await run(["crud", id, "--meta", "-"], bridge, "- a\n");
	assert.equal(result.code, 1);
	assert.match(result.err, /--meta takes a mapping/);
});

test("refuses meta its kind's schema forbids, and edits docs in workspace repos", async () => {
	const bridge = await tempBridge("crud-meta-kinds");
	ok(await run(["crud", "core:kind", "a task", "--name", "task", "--meta", "-"], bridge, "schema:\n  type: object\n  additionalProperties: false\n  properties:\n    owner: {type: string}\n"));
	const id = ok(await run(["crud", "task", "a", "task"], bridge)).replace(/^.*\/|\.md$/g, "");
	const refused = await run(["crud", id, "--meta", "-"], bridge, "bogus: 1\n");
	assert.equal(refused.code, 1);
	assert.match(refused.err, /meta does not fit kind task:\n {2}meta must NOT have additional properties/);
	ok(await run(["crud", id, "--meta", "-"], bridge, "owner: dan\n"));

	const repo = checkedOut(bridge, "other");
	const there = ok(await run(["--base", "workspace/other/kb", "crud", "core:memo", "over", "there"], bridge));
	const thereId = there.replace(/^.*\/|\.md$/g, "");
	assert.equal(ok(await run(["crud", thereId, "--meta", "-"], bridge, "a: 1\n")), there);
	assert.match(readFileSync(join(bridge, there), "utf8"), /\nmeta:\n {2}a: 1\n/);
	assert.match(git(["log", "-1", "--format=%s"], repo), /^crud\(\S+\): updated memo /);
});

const CLOSED = "schema:\n  type: object\n  additionalProperties: false\n  properties:\n    owner: {type: string}\n";

/** Commits a doc written by hand into a repo, as a person might. */
function commitDoc(repo: string, id: string, frontmatter: string): string {
	const path = join(repo, "kb", `${id}.md`);
	mkdirSync(join(repo, "kb"), { recursive: true });
	writeFileSync(path, `---\nkind: idea\nid: ${id}\nname: x\n${frontmatter}---\n\n# X\n`);
	git(["add", "-A"], repo);
	git(["commit", "-qm", "a doc"], repo);
	return path;
}

test("meta of a doc whose holder is no seeded repo goes in an entry for this repo's kind of that name, versioned, once published", async () => {
	const bridge = await tempBridge("crud-meta-entry");
	ok(await run(["crud", "core:kind", "An", "idea", "--name", "idea", "--meta", "-"], bridge, CLOSED));
	const loose = checkedOut(bridge, "loose");
	const id = "01a18e62-0000-7000-8000-0000000000e1";
	const path = commitDoc(loose, id, "");
	const refused = await run(["crud", id, "--meta", "-"], bridge, "owner: dan\n");
	assert.match(refused.err, /the schema of kind idea is not on its owner's origin trunk or a feat's work branch: land or push it first/);
	assert.doesNotMatch(readFileSync(path, "utf8"), /scopes/);

	const origin = tempDir("crud-meta-origin");
	git(["init", "-q", "--bare", "-b", "main"], origin);
	git(["remote", "add", "origin", origin], bridge);
	git(["push", "-q", "origin", "main"], bridge);
	const hero = findBridge(bridge)!;
	const kind = findKind("idea", hero, [core])!;
	const version = versionOf(kind);
	ok(await run(["crud", id, "--meta", "-"], bridge, "owner: dan\n"));
	const text = readFileSync(path, "utf8");
	assert.ok(text.includes(`\nscopes:\n  - ${hero.id}:\n      version: ${version}\n      schema: ${digestOf(kind)}\n      meta:\n        owner: dan\n---\n`), text);
	assert.doesNotMatch(text, /\nmeta:/, "the root's meta is the holder's, and nobody here owns it");
	assert.match((await run(["crud", id, "--meta", "-"], bridge, "bogus: 1\n")).err, /meta does not fit kind idea:\n {2}meta must NOT have additional properties/);

	ok(await run(["crud", id, "--meta", "-"], bridge, "owner: null\n"));
	assert.doesNotMatch(readFileSync(path, "utf8"), /scopes/, "an entry left with no meta is gone");
});

test("refuses meta for a kind the terms it is read in do not declare, naming the kind and saying the hero can declare one", async () => {
	const bridge = await tempBridge("crud-meta-undeclared");
	const loose = checkedOut(bridge, "loose");
	const id = "01a18e62-0000-7000-8000-0000000000e2";
	commitDoc(loose, id, "");
	assert.match((await run(["crud", id, "--meta", "-"], bridge, "a: 1\n")).err, /the kind idea of 01a18e62-0000-7000-8000-0000000000e2 is not declared where the doc is read; the hero can declare one of that name/);
});

test("a doc in a seeded workspace repo has its kind and meta read in that repo's terms, not the hero's", async () => {
	const bridge = await tempBridge("crud-meta-holder");
	ok(await run(["crud", "core:kind", "An", "idea", "--name", "idea", "--meta", "-"], bridge, CLOSED));
	const work = gitRepo("crud-meta-work");
	ok(await run(["seed"], work));
	ok(await run(["crud", "core:kind", "A thing", "--name", "thing", "--meta", "-"], work, "schema:\n  type: object\n  additionalProperties: false\n  properties:\n    a: {type: string}\n"));
	git(["clone", "-q", work, join(bridge, "workspace", "work")], bridge);
	const checkout = join(bridge, "workspace", "work");
	const id = "01a18e62-0000-7000-8000-0000000000e3";
	const path = commitDoc(checkout, id, "");
	// The hero declares an idea but no thing; the checkout declares a thing but no idea.
	writeFileSync(path, readFileSync(path, "utf8").replace("kind: idea", "kind: thing"));
	git(["commit", "-qam", "a thing"], checkout);
	assert.match((await run(["crud", id, "--meta", "-"], bridge, "owner: dan\n")).err, /meta does not fit kind thing:\n {2}meta must NOT have additional properties/);
	ok(await run(["crud", id, "--meta", "-"], bridge, "a: x\n"));
	assert.match(readFileSync(path, "utf8"), /\nmeta:\n {2}a: x\n/);
	assert.match(git(["log", "-1", "--format=%s"], checkout), /^crud\(\S+\): updated thing x$/);
	// A doc of an idea is the hero's kind to the hero, but the checkout does not declare it.
	const other = "01a18e62-0000-7000-8000-0000000000e4";
	const idea = commitDoc(checkout, other, "");
	const warned = await run(["crud", other, "--meta", "-"], bridge, "anything: 1\n");
	assert.equal(warned.code, 0);
	assert.match(warned.err, /no kind idea is declared here; its meta is not checked/);
	assert.match(readFileSync(idea, "utf8"), /\nmeta:\n {2}anything: 1\n/);
});

test("leaves a work scope, and its ref, as it is", async () => {
	const bridge = await tempBridge("crud-meta-work-scope");
	const path = ok(await run(["crud", "core:memo", "scoped"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	const repo = "01a18e62-0000-7000-8000-0000000000e5";
	ok(await run(["crud", id, "--scopes", "-"], bridge, `${repo}:\n  work-branch: work/x\n  ref: abc123\n`));
	ok(await run(["crud", id, "--meta", "-"], bridge, "a: 1\n"));
	const text = readFileSync(join(bridge, path), "utf8");
	assert.ok(text.includes(`  - ${repo}:\n      work-branch: work/x\n      ref: abc123\n`), text);
	assert.match(text, /canonical: true/);
	assert.match(text, /\nmeta:\n {2}a: 1\n/);
});

test("refuses a doc whose scopes repeat a key as it would be written, and --scopes repairs one", async () => {
	const bridge = await tempBridge("crud-meta-repeat");
	const id = "01a18e62-0000-7000-8000-0000000000e6";
	const path = commitDoc(bridge, id, `scopes:\n  - k:\n      a: 1\n  - k:\n      b: 2\n`);
	const refused = await run(["crud", id, "--gist", "changed"], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /scopes repeat the key k/);
	ok(await run(["crud", id, "--scopes", "-"], bridge, "k:\n  c: 3\n"));
	assert.match(readFileSync(path, "utf8"), /scopes:\n {2}- k:\n {6}b: 2\n {6}c: 3\n---/);
	assert.match((await run(["crud", id, "--scopes", "-"], bridge, "j:\n  kind: idea\n")).err, /scope j carries no kind: its kind is the root's/);
});

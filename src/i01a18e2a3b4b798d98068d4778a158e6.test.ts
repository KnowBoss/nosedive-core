// doc-kind
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { CORE_OWNER, i01a18e2a3b4b798d98068d4778a158e6 as docKind, scopeEntries } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { checkedOut, git, gitRepo, ok, run, tempBridge } from "../test/harness.ts";

const WORK = "01a18e62-0000-7000-8000-0000000000c1";

test("a doc with a canonical scope has the root kind's name, owned by that entry's key", async () => {
	const hero = findBridge(await tempBridge("doc-kind-canonical"))!;
	const doc = { fm: { kind: "dive", scopes: [{ [WORK]: { canonical: true, version: "abc" } }] }, path: join(hero.kbDir, "x.md") };
	assert.deepEqual(docKind(doc), { owner: WORK, name: "dive" });
});

test("else it has its holder's own kind: the hero's at home, the checkout's own for a doc in a seeded workspace repo", async () => {
	const dir = await tempBridge("doc-kind-holder");
	const hero = findBridge(dir)!;
	assert.deepEqual(docKind({ fm: { kind: "idea" }, path: join(hero.kbDir, "x.md") }), { owner: hero.id, name: "idea" });
	assert.deepEqual(docKind({ fm: { kind: "idea", scopes: [{ [hero.id!]: { meta: { a: 1 } } }] }, path: join(hero.kbDir, "x.md") }), { owner: hero.id, name: "idea" }, "an entry that is not canonical names no owner");
	assert.deepEqual(docKind({ fm: { kind: "idea" }, path: join(hero.kbDir, "x.md") }, WORK), { owner: WORK, name: "idea" }, "a holder given is the holder");

	const work = gitRepo("doc-kind-work");
	ok(await run(["seed"], work));
	const checkout = join(dir, "workspace", "work");
	git(["clone", "-q", work, checkout], dir);
	assert.deepEqual(docKind({ fm: { kind: "dive" }, path: join(checkout, "kb", "x.md") }), { owner: findBridge(checkout)!.id, name: "dive" });
	assert.deepEqual(docKind({ fm: { kind: "dive" }, path: join(checkedOut(dir, "plain"), "kb", "x.md") }), { owner: undefined, name: "dive" }, "a repo that is not seeded owns nothing, though it is in the hero's workspace");
});

test("docs in .nosedive/kinds and .nosedive/repos are core's kind and repo, whatever they say", async () => {
	const hero = findBridge(await tempBridge("doc-kind-place"))!;
	assert.deepEqual(docKind({ fm: { kind: "memo" }, path: join(hero.dir, ".nosedive", "kinds", "x.md") }), { owner: CORE_OWNER, name: "kind" });
	assert.deepEqual(docKind({ fm: { kind: "kind", scopes: [{ [WORK]: { canonical: true } }] }, path: join(hero.dir, ".nosedive", "repos", "x.md") }), { owner: CORE_OWNER, name: "repo" });
});

test("refuses a key repeated in scopes, and two canonical owners", async () => {
	const hero = findBridge(await tempBridge("doc-kind-refused"))!;
	const path = join(hero.kbDir, "x.md");
	assert.throws(() => docKind({ fm: { kind: "dive", scopes: [{ [WORK]: { canonical: true } }, { [WORK]: { meta: {} } }] }, path }), /scopes repeat the key/);
	assert.throws(() => docKind({ fm: { kind: "dive", scopes: [{ [WORK]: { canonical: true } }, { [CORE_OWNER]: { canonical: true } }] }, path }), /more than one canonical scope/);
	assert.throws(() => scopeEntries({ [WORK]: {} }), /must be a list/);
	assert.throws(() => scopeEntries([{ [WORK]: "x" }]), /must be a mapping/);
	assert.equal(scopeEntries(undefined).size, 0);
	assert.deepEqual([...scopeEntries([{ a: { "work-branch": "w" } }, { b: {} }]).keys()], ["a", "b"], "a work scope is an entry like another");
});

test("a bare string in scopes is that key with an empty entry, which is never canonical; repeating its key is refused", async () => {
	const hero = findBridge(await tempBridge("doc-kind-bare"))!;
	assert.deepEqual([...scopeEntries([WORK, { b: { "work-branch": "w" } }])], [[WORK, {}], ["b", { "work-branch": "w" }]]);
	assert.deepEqual(docKind({ fm: { kind: "dive", scopes: [WORK] }, path: join(hero.kbDir, "x.md") }, "holder"), { owner: "holder", name: "dive" });
	assert.throws(() => scopeEntries([WORK, { [WORK]: {} }]), /scopes repeat the key/);
	assert.throws(() => scopeEntries([{ [WORK]: {} }, WORK]), /scopes repeat the key/);
	assert.throws(() => scopeEntries([WORK, WORK]), /scopes repeat the key/);
});

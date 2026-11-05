// commit-subject
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { subjectLine } from "./i01a19005c109715583553072f4e38dc4.ts";
import { git, ok, run, tempBridge, kbOf, kbPath } from "../test/harness.ts";

const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");
const subject = (dir: string) => git(["log", "-1", "--format=%s"], dir);
const coAuthors = (dir: string, rev = "HEAD") => git(["log", "-1", "--format=%B", rev], dir).split("\n").filter((line) => line === "Co-Authored-By: nosedive source <noreply@nosedive.dev>").length;

/** A hero whose root links a feat `ideas`, as work does, and a memo `note` that links nothing yet. */
async function heroWithFeat(label: string) {
	const bridge = await tempBridge(label);
	const root = findBridge(bridge)!.root!;
	const feat = ok(await run(["crud", "core:memo", "ideas", "--name", "ideas"], bridge));
	const note = ok(await run(["crud", "core:memo", "a", "note", "--name", "note"], bridge));
	ok(await run(["crud", root, "--links", "-"], bridge, `${feat}: {rel: work.feat}\n`));
	return { bridge, root, feat, note, featId: idOf(feat), noteId: idOf(note) };
}

test("a subject names the feat when there is one, else is plain", () => {
	assert.equal(subjectLine("ideas", "crud", "links"), "feat(ideas): crud links");
	assert.equal(subjectLine(undefined, "crud", "links"), "crud: links");
	assert.equal(subjectLine("ideas", "pass", "test"), "feat(ideas): pass test");
});

test("a doc with no feat gets a plain subject, and nothing refuses", async () => {
	const { bridge, noteId } = await heroWithFeat("subject-plain");
	ok(await run(["crud", noteId, "--gist", "changed"], bridge));
	assert.equal(subject(bridge), "crud: gist");
	ok(await run(["crud", "core:memo", "another"], bridge));
	assert.equal(subject(bridge), "crud: core:memo");
});

test("the feat is the edited doc's own when the hero's roots reach it, else the first its .feat or .spec links reach", async () => {
	const { bridge, feat, noteId, featId } = await heroWithFeat("subject-doc");
	ok(await run(["crud", featId, "--gist", "changed"], bridge));
	assert.equal(subject(bridge), "feat(ideas): crud gist");

	ok(await run(["crud", noteId, "--links", "-"], bridge, `${feat}: {rel: parent.feat}\n`));
	assert.equal(subject(bridge), "feat(ideas): crud links", "found through the doc's own links");
	ok(await run(["crud", noteId, "--body", "-"], bridge, "text\n"));
	assert.equal(subject(bridge), "feat(ideas): crud body", "and still");

	const answer = ok(await run(["crud", "core:memo", "decided"], bridge));
	ok(await run(["crud", idOf(answer), "--links", "-"], bridge, `${feat}: {rel: closed.spec}\n`));
	assert.equal(subject(bridge), "feat(ideas): crud links", "a .spec link reaches it too");

	ok(await run(["crud", noteId, "--links", "-"], bridge, `${feat}: null\n`));
	ok(await run(["crud", noteId, "--gist", "alone"], bridge));
	assert.equal(subject(bridge), "crud: gist", "a doc whose links reach no feat is plain");
});

test("an edit of a root is no feat's, though its .feat links reach the feats it holds", async () => {
	const { bridge, root } = await heroWithFeat("subject-root");
	ok(await run(["crud", root, "--gist", "changed"], bridge));
	assert.equal(subject(bridge), "crud: gist");
});

test("a batch names its edits, once each in order, and a drop is a drop", async () => {
	const { bridge, feat, noteId } = await heroWithFeat("subject-batch");
	ok(await run(["crud", noteId, "--links", "-"], bridge, `${feat}: {rel: parent.feat}\n`));
	ok(await run(["crud", "--batch", "-"], bridge, `- quid: ${noteId}\n  gist: one\n- quid: ${noteId}\n  body: text\n- quid: ${noteId}\n  gist: two\n`));
	assert.equal(subject(bridge), "feat(ideas): crud gist, body");
	ok(await run(["crud", "--drop", noteId, "--hard"], bridge));
	assert.equal(subject(bridge), "feat(ideas): crud drop", "named by the links the doc had");
});

/** Writes dive `n` of the feat `featId`, held by `diver`, and has the feat link it as dives.feat when `linked`. */
async function dive(bridge: string, feat: string, n: number, meta: { diver: string; outcome?: string; linked?: boolean }) {
	const id = `01a19005-0000-7000-8000-00000000000${n}`;
	writeFileSync(join(kbOf(bridge), `${id}.md`), `---\nkind: dive\nid: ${id}\nname: ideas.00000${n}\nmeta:\n  feat: ${idOf(feat)}\n  diver: ${meta.diver}\n${meta.outcome ? `  outcome: ${meta.outcome}\n` : ""}---\n\n# A dive\n`);
	git(["add", "-A"], bridge);
	git(["commit", "-qm", "a dive"], bridge);
	if (meta.linked !== false) ok(await run(["crud", idOf(feat), "--links", "-"], bridge, `${kbPath(bridge, id)}: {rel: dives.feat}\n`));
}

test("the feat the hero's branch names wins, for a mint too, by its own name whatever its kind", async () => {
	const { bridge, noteId, feat } = await heroWithFeat("subject-branch");
	const other = ok(await run(["crud", "core:memo", "other", "--name", "other"], bridge));
	ok(await run(["crud", findBridge(bridge)!.root!, "--links", "-"], bridge, `${other}: {rel: work.feat}\n`));
	// A dive is a feat by its dives.feat link; core reads neither its kind nor its meta.
	await dive(bridge, other, 1, { diver: "anyone" });
	git(["switch", "-q", "-c", "nosedive/0123456789ab/01a19005-0000-7000-8000-000000000001"], bridge);
	ok(await run(["crud", noteId, "--gist", "on its branch"], bridge));
	assert.equal(subject(bridge), "feat(ideas.000001): crud gist");
	ok(await run(["crud", "core:memo", "fresh"], bridge));
	assert.equal(subject(bridge), "feat(ideas.000001): crud core:memo");
	ok(await run(["crud", idOf(feat), "--gist", "its own feat"], bridge));
	assert.equal(subject(bridge), "feat(ideas.000001): crud gist", "over the doc's own feat");

	git(["switch", "-q", "-c", `topic/${idOf(other)}`], bridge);
	ok(await run(["crud", noteId, "--gist", "any branch ending in a feat's quid"], bridge));
	assert.equal(subject(bridge), "feat(other): crud gist");
});

test("a branch naming a quid no feat's link reaches, or none, names no feat", async () => {
	const { bridge, noteId, feat } = await heroWithFeat("subject-branch-none");
	await dive(bridge, feat, 2, { diver: "anyone", linked: false });
	git(["switch", "-q", "-c", "nosedive/0123456789ab/01a19005-0000-7000-8000-000000000002"], bridge);
	ok(await run(["crud", noteId, "--gist", "unlinked"], bridge));
	assert.equal(subject(bridge), "crud: gist", "a doc no feat links is not found by reading the kb");
	git(["switch", "-q", "-c", "plain"], bridge);
	ok(await run(["crud", noteId, "--gist", "plain"], bridge));
	assert.equal(subject(bridge), "crud: gist");
});

test("a decision a feat links as closed.spec, which links nothing back, is grouped under that feat", async () => {
	const { bridge, featId } = await heroWithFeat("subject-backlink");
	const decision = ok(await run(["crud", "core:memo", "decided", "--name", "decided"], bridge));
	ok(await run(["crud", featId, "--links", "-"], bridge, `${decision}: {rel: closed.spec}\n`));
	ok(await run(["crud", idOf(decision), "--gist", "answered"], bridge));
	assert.equal(subject(bridge), "feat(ideas): crud gist");
	const question = ok(await run(["crud", "core:memo", "asked", "--name", "asked"], bridge));
	ok(await run(["crud", idOf(question), "--gist", "unlinked"], bridge));
	assert.equal(subject(bridge), "crud: gist", "a doc no feat links stays plain");
});

test("every commit ends with the nosedive co-author, once", async () => {
	const { bridge, feat, noteId } = await heroWithFeat("subject-co-author");
	ok(await run(["crud", noteId, "--links", "-"], bridge, `${feat}: {rel: parent.feat}\n`));
	assert.equal(coAuthors(bridge), 1, "an edit's");
	ok(await run(["crud", "--batch", "-"], bridge, `- quid: ${noteId}\n  gist: one\n`));
	assert.equal(coAuthors(bridge), 1, "a batch's");
	const path = ok(await run(["crud", "core:memo", "fresh"], bridge));
	assert.equal(coAuthors(bridge), 1, "a mint's");
	ok(await run(["crud", "--drop", idOf(path), "--hard"], bridge));
	assert.equal(coAuthors(bridge), 1, "a drop's");
	for (const rev of git(["rev-list", "HEAD"], bridge).split("\n")) assert.equal(coAuthors(bridge, rev), 1, `${git(["log", "-1", "--format=%s", rev], bridge)}`);
});

// commit-subject
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { holderToken, subjectLine } from "./i01a19005c109715583553072f4e38dc4.ts";
import { git, ok, run, tempBridge } from "../test/harness.ts";

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

test("a batch names its edits, once each in order, and a drop is a drop", async () => {
	const { bridge, feat, noteId } = await heroWithFeat("subject-batch");
	ok(await run(["crud", noteId, "--links", "-"], bridge, `${feat}: {rel: parent.feat}\n`));
	ok(await run(["crud", "--batch", "-"], bridge, `- quid: ${noteId}\n  gist: one\n- quid: ${noteId}\n  body: text\n- quid: ${noteId}\n  gist: two\n`));
	assert.equal(subject(bridge), "feat(ideas): crud gist, body");
	ok(await run(["crud", "--drop", noteId, "--hard"], bridge));
	assert.equal(subject(bridge), "feat(ideas): crud drop", "named by the links the doc had");
});

test("the feat of the dive this worktree holds wins, for a mint too; an over dive holds nothing", async () => {
	const { bridge, noteId } = await heroWithFeat("subject-held");
	const other = ok(await run(["crud", "core:memo", "other", "--name", "other"], bridge));
	const root = findBridge(bridge)!.root!;
	ok(await run(["crud", root, "--links", "-"], bridge, `${other}: {rel: work.feat}\n`));
	const token = holderToken(bridge)!;
	assert.match(token, /^core@example\.com#[0-9a-f]{12}$/);

	const dive = (outcome?: string) =>
		writeFileSync(join(bridge, "kb", "01a19005-0000-7000-8000-000000000001.md"), `---\nkind: dive\nid: 01a19005-0000-7000-8000-000000000001\nname: ideas.000001\nmeta:\n  feat: ${idOf(other)}\n  diver: ${token}\n${outcome ? `  outcome: ${outcome}\n` : ""}---\n\n# A dive\n`);
	dive();
	git(["add", "-A"], bridge);
	git(["commit", "-qm", "a dive"], bridge);
	ok(await run(["crud", noteId, "--gist", "held"], bridge));
	assert.equal(subject(bridge), "feat(other): crud gist");
	ok(await run(["crud", "core:memo", "fresh"], bridge));
	assert.equal(subject(bridge), "feat(other): crud core:memo");

	dive("landed");
	git(["commit", "-qam", "over"], bridge);
	ok(await run(["crud", noteId, "--gist", "free"], bridge));
	assert.equal(subject(bridge), "crud: gist");
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

// next
import assert from "node:assert/strict";
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { git, gitRepo, ok, run, tempBridge, tempDir } from "../test/harness.ts";

const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");
const rootOf = (bridge: string) => /roots:\r?\n {2}- (\S+)/.exec(readFileSync(join(bridge, ".nosedive", "config.yaml"), "utf8"))![1]!;

/** Declares a kind of the hero's own, with its Done when when given. */
async function kind(bridge: string, name: string, meta: string, doneWhen?: string): Promise<void> {
	const path = ok(await run(["crud", "core:kind", `a ${name}`, "--name", name, "--meta", "-"], bridge, `schema:\n  type: object\n  additionalProperties: true\n${meta}`));
	if (doneWhen) ok(await run(["crud", idOf(path), "--section", "Done when", "-"], bridge, `${doneWhen}\n`));
}

async function link(bridge: string, from: string, to: string, rel: string): Promise<void> {
	ok(await run(["crud", idOf(from), "--links", "-"], bridge, `${to}:\n  rel: ${rel}\n`));
}

test("says nothing is left to do when no leaf is work", async () => {
	const bridge = await tempBridge("next-empty");
	assert.equal(ok(await run(["next"], bridge)), "nothing left to do");
});

test("lists the non-durable leaves the feats reach under the doc that reaches them, and docs a kind's next rels link", async () => {
	const bridge = await tempBridge("next-leaves");
	const root = rootOf(bridge);
	await kind(bridge, "keep", "");
	await kind(bridge, "step", "", "It is landed or bailed.");
	await kind(bridge, "ask", "next:\n  - open.spec\n", "It is answered.");
	const feat = ok(await run(["crud", "core:memo", "the feat", "--name", "feat"], bridge));
	const one = ok(await run(["crud", "step", "one", "--name", "one"], bridge));
	const two = ok(await run(["crud", "step", "two", "--name", "two"], bridge));
	const kept = ok(await run(["crud", "keep", "kept", "--name", "kept"], bridge));
	const loose = ok(await run(["crud", "core:memo", "loose", "--name", "loose"], bridge));
	const note = ok(await run(["crud", "core:memo", "a note", "--name", "note"], bridge));
	const question = ok(await run(["crud", "ask", "what?", "--name", "question"], bridge));
	const unlisted = ok(await run(["crud", "step", "not a next rel", "--name", "unlisted"], bridge));
	await link(bridge, root, feat, "work.feat");
	await link(bridge, root, kept, "kept.feat");
	await link(bridge, root, loose, "work.feat");
	await link(bridge, root, note, "notes.note");
	await link(bridge, feat, one, "dives.feat");
	await link(bridge, feat, two, "dives.feat");
	await link(bridge, feat, question, "open.spec");
	await link(bridge, feat, unlisted, "open.spec");

	const rootName = String(/\nname: (.+)\n/.exec(readFileSync(join(bridge, root), "utf8"))![1]);
	assert.equal(
		ok(await run(["next"], bridge)),
		[
			`${rootName}  ${root}`,
			`  core:memo loose  ${loose}`,
			"    done when: What it was written for is done, reviewed and tested, and whatever it settled lives on in durable docs.",
			`feat  ${feat}`,
			`  step one  ${one}`,
			"    done when: It is landed or bailed.",
			`  step two  ${two}`,
			"    done when: It is landed or bailed.",
			`  ask question  ${question}`,
			"    done when: It is answered.",
		].join("\n"),
	);
});

test("passes over a doc whose kind's doc has no Done when, since that kind is durable", async () => {
	const bridge = await tempBridge("next-no-done-when");
	await kind(bridge, "step", "");
	const step = ok(await run(["crud", "step", "one", "--name", "one"], bridge));
	await link(bridge, rootOf(bridge), step, "work.feat");
	assert.equal(ok(await run(["next"], bridge)), "nothing left to do");
});

test("lists a doc whose kind's Done when section is empty, saying so", async () => {
	const bridge = await tempBridge("next-empty-done-when");
	const path = ok(await run(["crud", "core:kind", "a step", "--name", "step", "--meta", "-"], bridge, "schema:\n  type: object\n  additionalProperties: true\n"));
	appendFileSync(join(bridge, path), "\n## Done when\n");
	const step = ok(await run(["crud", "step", "one", "--name", "one"], bridge));
	await link(bridge, rootOf(bridge), step, "work.feat");
	assert.match(ok(await run(["next"], bridge)), /\n {4}done when: its kind's Done when section is empty; read the doc$/);
});

test("crud says when an edit of a kind's Done when makes it durable or not", async () => {
	const bridge = await tempBridge("next-done-when-flips");
	const path = ok(await run(["crud", "core:kind", "a step", "--name", "step", "--meta", "-"], bridge, "schema:\n  type: object\n  additionalProperties: true\n"));
	const added = await run(["crud", idOf(path), "--section", "Done when", "-"], bridge, "It is landed.\n");
	assert.match(added.err, /kind step is no longer durable, since its doc now says when a doc of it is done/);
	const reworded = await run(["crud", idOf(path), "--section", "Done when", "-"], bridge, "It is landed or bailed.\n");
	assert.doesNotMatch(reworded.err, /durable/, "rewording it changes nothing");
	const removed = await run(["crud", idOf(path), "--section", "Done when", "-"], bridge, "");
	assert.match(removed.err, /kind step is now durable, since its doc no longer says when a doc of it is done/);
});

test("fetches origin first, and still lists but exits 1 when the hero is behind its trunk", async () => {
	const bridge = await tempBridge("next-behind");
	const origin = tempDir("next-origin");
	git(["init", "-q", "--bare", origin], origin);
	const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], bridge);
	git(["remote", "add", "origin", origin], bridge);
	git(["push", "-q", "origin", branch], bridge);
	git(["symbolic-ref", "HEAD", `refs/heads/${branch}`], origin);
	assert.equal(ok(await run(["next"], bridge)), "nothing left to do", "level with trunk, it says nothing of it");

	const other = gitRepo("next-other");
	git(["fetch", "-q", origin, branch], other);
	git(["reset", "-q", "--hard", "FETCH_HEAD"], other);
	git(["commit", "-q", "--allow-empty", "-m", "elsewhere"], other);
	git(["push", "-q", origin, `HEAD:${branch}`], other);

	const behind = await run(["next"], bridge);
	assert.equal(behind.code, 1);
	assert.equal(behind.out, `nose: the hero lacks 1 commits origin's trunk has: rebase onto origin/${branch} before trusting this list\nnothing left to do`);
	assert.match(behind.err, new RegExp(`the hero is behind origin/${branch}`));
});

test("lists the hero as it is, saying so, when origin cannot be fetched", async () => {
	const bridge = await tempBridge("next-unreachable");
	git(["remote", "add", "origin", join(tempDir("next-gone"), "missing")], bridge);
	const result = await run(["next"], bridge);
	assert.equal(result.code, 0);
	assert.equal(result.out, "nothing left to do");
	assert.match(result.err, /could not fetch origin, so this lists the hero as it is: /);
});

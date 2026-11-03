// next
import assert from "node:assert/strict";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { test } from "node:test";
import { git, gitRepo, ok, run, tempBridge, tempDir } from "../test/harness.ts";
import { i01a1336a958f71c7beec4db3195c7966 as launch, type Cape, type Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";

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
	const loose = ok(await run(["crud", "step", "loose", "--name", "loose"], bridge));
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
			`  step loose  ${loose}`,
			"    done when: It is landed or bailed.",
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
	assert.equal(behind.out, "nothing left to do", "stdout is the list alone");
	assert.equal(behind.err, `warning: the hero lacks 1 commits origin's trunk has: rebase onto origin/${branch} before trusting this list\nnosedive: the hero is behind origin/${branch}`);
});

test("lists the hero as it is, saying so, when origin cannot be fetched", async () => {
	const bridge = await tempBridge("next-unreachable");
	git(["remote", "add", "origin", join(tempDir("next-gone"), "missing")], bridge);
	const result = await run(["next"], bridge);
	assert.equal(result.code, 0);
	assert.equal(result.out, "nothing left to do");
	assert.match(result.err, /could not fetch origin, so this lists the hero as it is: /);
});

/** Runs next as a core of the given version would, with npm's latest served by a local server that counts its asks. */
async function nextAs(version: string, cwd: string): Promise<{ code: number; err: string }> {
	const core: Cape = { ...(await sourceCape()), version };
	const err: string[] = [];
	const ctx: Ctx = { cwd, capes: [core], out: () => {}, err: (text) => err.push(text), stdin: async () => "" };
	const code = await launch(["next"], ctx);
	return { code, err: err.join("\n") };
}

async function npmServing(version: string): Promise<{ url: string; asks: () => number; close: () => Promise<void> }> {
	let asked = 0;
	const server = createServer((_req, res) => {
		asked += 1;
		res.setHeader("content-type", "application/json");
		res.end(JSON.stringify({ name: "nosedive", version }));
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address() as AddressInfo;
	return { url: `http://127.0.0.1:${port}/nosedive/latest`, asks: () => asked, close: () => new Promise((resolve) => server.close(() => resolve())) };
}

test("warns once a week's ask finds a newer y.m.d on npm, and says nothing of the same or an older one", async () => {
	const npm = await npmServing("2026.12.1");
	const before = process.env.NOSEDIVE_NPM_LATEST;
	process.env.NOSEDIVE_NPM_LATEST = npm.url;
	try {
		const bridge = await tempBridge("next-npm-newer");
		const first = await nextAs("2026.11.3-1793748529194", bridge);
		assert.equal(first.code, 0, "advice never fails next");
		assert.equal(first.err, "warning: nosedive 2026.12.1 is published; you run 2026.11.3-1793748529194: npm i -g nosedive");
		assert.match(readFileSync(join(bridge, ".nosedive", "local", "npm-latest"), "utf8"), /"version":"2026\.12\.1"/, "the answer is recorded");
		assert.match((await nextAs("2026.11.3-1", bridge)).err, /nosedive 2026\.12\.1 is published/, "and warned from the record");
		assert.equal(npm.asks(), 1, "a week has not passed, so npm is asked once");
		assert.equal((await nextAs("2026.12.1-5", bridge)).err, "", "the same y.m.d, whatever its build");
		assert.equal((await nextAs("2027.1.1", bridge)).err, "", "an older one");

		// A record older than a week is asked again.
		writeFileSync(join(bridge, ".nosedive", "local", "npm-latest"), `${JSON.stringify({ checked: new Date(Date.now() - 8 * 86400000).toISOString(), version: "2026.12.1" })}\n`);
		await nextAs("2026.11.3", bridge);
		assert.equal(npm.asks(), 2);
	} finally {
		if (before === undefined) delete process.env.NOSEDIVE_NPM_LATEST;
		else process.env.NOSEDIVE_NPM_LATEST = before;
		await npm.close();
	}
});

test("says nothing when npm cannot be asked, and asks again next time; a core run from source is never checked", async () => {
	const before = process.env.NOSEDIVE_NPM_LATEST;
	process.env.NOSEDIVE_NPM_LATEST = "http://127.0.0.1:9/nosedive/latest";
	try {
		const bridge = await tempBridge("next-npm-offline");
		const offline = await nextAs("2026.11.3", bridge);
		assert.equal(offline.code, 0);
		assert.equal(offline.err, "");
		assert.equal(existsSync(join(bridge, ".nosedive", "local", "npm-latest")), false, "a failed ask is not recorded, so the next run tries again");
		const npm = await npmServing("2030.1.1");
		process.env.NOSEDIVE_NPM_LATEST = npm.url;
		try {
			assert.equal((await nextAs("source", bridge)).err, "", "no y.m.d to compare");
			assert.equal(npm.asks(), 0);
		} finally {
			await npm.close();
		}
	} finally {
		if (before === undefined) delete process.env.NOSEDIVE_NPM_LATEST;
		else process.env.NOSEDIVE_NPM_LATEST = before;
	}
});

test("a record it cannot read or keep, or dated ahead, never stops the check: npm is asked again, and its answer still counts", async () => {
	const npm = await npmServing("2026.12.1");
	const before = process.env.NOSEDIVE_NPM_LATEST;
	process.env.NOSEDIVE_NPM_LATEST = npm.url;
	try {
		const bridge = await tempBridge("next-npm-record");
		const record = join(bridge, ".nosedive", "local", "npm-latest");
		writeFileSync(record, "{trunc");
		assert.match((await nextAs("2026.11.3", bridge)).err, /nosedive 2026\.12\.1 is published/, "a corrupt record is asked past");
		assert.match(readFileSync(record, "utf8"), /"version":"2026\.12\.1"/, "and rewritten");
		writeFileSync(record, `${JSON.stringify({ checked: new Date(Date.now() + 30 * 86400000).toISOString(), version: "2000.1.1" })}\n`);
		assert.match((await nextAs("2026.11.3", bridge)).err, /nosedive 2026\.12\.1 is published/, "a date ahead of now is no recent ask");
		assert.equal(npm.asks(), 2);
		rmSync(record);
		mkdirSync(record);
		assert.match((await nextAs("2026.11.3", bridge)).err, /nosedive 2026\.12\.1 is published/, "a record it cannot write still warns from what npm said");
		assert.equal(npm.asks(), 3);
	} finally {
		if (before === undefined) delete process.env.NOSEDIVE_NPM_LATEST;
		else process.env.NOSEDIVE_NPM_LATEST = before;
		await npm.close();
	}
});

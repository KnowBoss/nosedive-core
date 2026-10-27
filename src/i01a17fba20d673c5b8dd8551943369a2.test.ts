// dehydrate-repo
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a15baf13e27bd88dc880d4871f2210 as hydrateRepo } from "./i01a15baf13e27bd88dc880d4871f2210.ts";
import { i01a17fba20d673c5b8dd8551943369a2 as dehydrateRepo } from "./i01a17fba20d673c5b8dd8551943369a2.ts";
import { git, gitRepo, kbOf, registerRepo, tempBridge } from "../test/harness.ts";

/** A ship with repo `hello` registered, its origin a bare repo of one commit on main. */
async function hello(label: string) {
	const bridge = await tempBridge(label);
	const work = gitRepo(`${label}-work`);
	writeFileSync(join(work, ".gitignore"), "build/\n");
	git(["add", "-A"], work);
	git(["commit", "-qm", "first"], work);
	const origin = join(gitRepo(`${label}-origin`), "hello.git");
	git(["clone", "-q", "--bare", work, origin], work);
	const id = await registerRepo(bridge, "hello", origin);
	git(["add", kbOf(bridge)], bridge);
	git(["commit", "-qm", "hello"], bridge);
	const ship = findBridge(bridge)!;
	const doc = findKbDoc(ship.kbDir, id)!;
	const said: string[] = [];
	const say = { out: (text: string) => void said.push(text), err: (text: string) => void said.push(`err: ${text}`) };
	const checkout = join(bridge, "workspace", "hello");
	const commit = (message: string) => {
		git(["config", "user.name", "Core Test"], checkout);
		git(["config", "user.email", "core@example.com"], checkout);
		git(["commit", "-q", "--allow-empty", "-m", message], checkout);
	};
	return { ship, doc, said, say, origin, checkout, commit };
}

test("pushes a feat's branch to its packed ref on origin and removes the checkout; the next hydrate picks it up", async () => {
	const { ship, doc, said, say, origin, checkout, commit } = await hello("dehydrate-repo");
	hydrateRepo(ship, doc, say, { id: "feat", workBranch: "work" });
	commit("feat work");
	dehydrateRepo(ship, doc, say);
	const branch = `${ship.id}/main/feat`;
	assert.equal(said.at(-1), `workspace/hello: pushed to refs/nosedive/${branch} and put away`);
	assert.equal(existsSync(checkout), false);
	assert.equal(git(["log", "-1", "--format=%s", `refs/nosedive/${branch}`], origin), "feat work");
	assert.equal(git(["for-each-ref", "refs/heads"], origin).includes("work"), false, "only land moves a work branch");

	hydrateRepo(ship, doc, say, { id: "feat", workBranch: "work" });
	assert.equal(git(["log", "-1", "--format=%s"], checkout), "feat work");
});

test("refuses, keeping the checkout, while it has changes, untracked files, or ignored files not discarded", async () => {
	const { ship, doc, say, checkout } = await hello("dehydrate-repo-files");
	hydrateRepo(ship, doc, say, { id: "feat", workBranch: "work" });
	writeFileSync(join(checkout, "new.txt"), "new\n");
	assert.throws(() => dehydrateRepo(ship, doc, say), /workspace\/hello has changes it would lose, so it stays:\n {2}\?\? new\.txt/);
	assert.throws(() => dehydrateRepo(ship, doc, say, { discard: true }), /has changes it would lose/, "discarding never takes untracked files");
	git(["add", "new.txt"], checkout);
	git(["-c", "user.name=T", "-c", "user.email=t@example.com", "commit", "-qm", "new"], checkout);
	mkdirSync(join(checkout, "build"));
	writeFileSync(join(checkout, "build", "out.js"), "built\n");
	assert.throws(() => dehydrateRepo(ship, doc, say), /has ignored files it would lose, so it stays; discard them to go on:\n {2}build\/out\.js/);
	assert.equal(existsSync(checkout), true);
	dehydrateRepo(ship, doc, say, { discard: true });
	assert.equal(existsSync(checkout), false);
});

test("lets a detached checkout go when origin has its commit, and refuses one holding commits origin lacks", async () => {
	const { ship, doc, said, say, checkout, commit } = await hello("dehydrate-repo-detached");
	hydrateRepo(ship, doc, say);
	dehydrateRepo(ship, doc, say);
	assert.equal(said.at(-1), "workspace/hello: put away");
	assert.equal(existsSync(checkout), false);

	hydrateRepo(ship, doc, say);
	commit("stray");
	assert.throws(() => dehydrateRepo(ship, doc, say), /workspace\/hello is detached with commits origin does not have, so it stays; put them on a branch:\n {2}\w+ stray/);
	assert.equal(existsSync(checkout), true);
});

test("says a repo with no checkout has none", async () => {
	const { ship, doc, said, say } = await hello("dehydrate-repo-none");
	dehydrateRepo(ship, doc, say);
	assert.equal(said.at(-1), "workspace/hello: not checked out");
});

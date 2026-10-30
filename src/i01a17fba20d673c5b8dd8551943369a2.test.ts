// dehydrate-repo
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a15baf13e27bd88dc880d4871f2210 as hydrateRepo } from "./i01a15baf13e27bd88dc880d4871f2210.ts";
import { i01a17fba20d673c5b8dd8551943369a2 as dehydrateRepo } from "./i01a17fba20d673c5b8dd8551943369a2.ts";
import { git, gitRepo, registerRepo, tempBridge } from "../test/harness.ts";

/** A hero repo with repo `hello` registered, its origin a bare repo of one commit on main. */
async function hello(label: string) {
	const bridge = await tempBridge(label);
	const work = gitRepo(`${label}-work`);
	writeFileSync(join(work, ".gitignore"), "build/\n");
	git(["add", "-A"], work);
	git(["commit", "-qm", "first"], work);
	const origin = join(gitRepo(`${label}-origin`), "hello.git");
	git(["clone", "-q", "--bare", work, origin], work);
	const id = await registerRepo(bridge, "hello", origin);
	git(["add", ".nosedive/repos"], bridge);
	git(["commit", "-qm", "hello"], bridge);
	const hero = findBridge(bridge)!;
	const doc = findKbDoc(hero.reposDir!, id)!;
	const said: string[] = [];
	const say = { out: (text: string) => void said.push(text), err: (text: string) => void said.push(`err: ${text}`) };
	const checkout = join(bridge, "workspace", "hello");
	const commit = (message: string) => {
		git(["config", "user.name", "Core Test"], checkout);
		git(["config", "user.email", "core@example.com"], checkout);
		git(["commit", "-q", "--allow-empty", "-m", message], checkout);
	};
	return { hero, doc, said, say, origin, checkout, commit };
}

test("pushes nothing, and refuses a checkout with commits origin lacks, on a branch or detached, until a ref on origin holds them", async () => {
	const { hero, doc, said, say, origin, checkout, commit } = await hello("dehydrate-repo");
	hydrateRepo(hero, doc, say, { id: "feat", workBranch: "work" });
	commit("feat work");
	assert.throws(() => dehydrateRepo(hero, doc, say), /workspace\/hello has commits origin does not have, so it stays:\n {2}\w+ feat work/);
	assert.equal(existsSync(checkout), true);
	assert.equal(git(["for-each-ref", "refs/nosedive"], origin), "", "nothing was pushed");

	// A cape keeps work under its own refs; once origin holds them, as last fetched, the checkout can go.
	git(["push", "-q", "origin", "HEAD:refs/nosedive/dives/x"], checkout);
	git(["update-ref", "refs/nosedive/dives/x", "HEAD"], checkout);
	dehydrateRepo(hero, doc, say);
	assert.equal(said.at(-1), "workspace/hello: put away");
	assert.equal(existsSync(checkout), false);

	hydrateRepo(hero, doc, say);
	commit("stray");
	assert.throws(() => dehydrateRepo(hero, doc, say), /has commits origin does not have, so it stays:\n {2}\w+ stray/, "detached too");
});

test("refuses, keeping the checkout, while it has changes or untracked files, and names its ignored files in an error a cape can act on", async () => {
	const { hero, doc, say, checkout } = await hello("dehydrate-repo-files");
	hydrateRepo(hero, doc, say, { id: "feat", workBranch: "work" });
	writeFileSync(join(checkout, "new.txt"), "new\n");
	assert.throws(() => dehydrateRepo(hero, doc, say), /workspace\/hello has changes it would lose, so it stays:\n {2}\?\? new\.txt/);
	assert.throws(() => dehydrateRepo(hero, doc, say, { discard: true }), /has changes it would lose/, "discarding never takes untracked files");
	rmSync(join(checkout, "new.txt"));
	mkdirSync(join(checkout, "build"));
	writeFileSync(join(checkout, "build", "out.js"), "built\n");
	assert.throws(() => dehydrateRepo(hero, doc, say), (error: Error & { ignored?: string[] }) => {
		assert.equal(error.name, "DehydrateIgnored");
		assert.deepEqual(error.ignored, ["build/out.js"]);
		assert.match(error.message, /has ignored files it would lose, so it stays; discard them to go on:\n {2}build\/out\.js/);
		return true;
	});
	assert.equal(existsSync(checkout), true);
	dehydrateRepo(hero, doc, say, { discard: true });
	assert.equal(existsSync(checkout), false);
});

test("says a repo with no checkout has none", async () => {
	const { hero, doc, said, say } = await hello("dehydrate-repo-none");
	dehydrateRepo(hero, doc, say);
	assert.equal(said.at(-1), "workspace/hello: not checked out");
});

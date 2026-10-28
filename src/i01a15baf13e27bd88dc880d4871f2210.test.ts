// hydrate-repo
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a15baf13e27bd88dc880d4871f2210 as hydrateRepo } from "./i01a15baf13e27bd88dc880d4871f2210.ts";
import { git, gitRepo, kbOf, registerRepo, tempBridge } from "../test/harness.ts";

/** A hero repo with repo `hello` registered and committed, its origin a repo of one commit on trunk. */
async function hello(label: string) {
	const bridge = await tempBridge(label);
	const source = gitRepo(`${label}-source`);
	git(["checkout", "-q", "-b", "trunk"], source);
	git(["commit", "-q", "--allow-empty", "-m", "first"], source);
	const id = await registerRepo(bridge, "hello", source);
	git(["add", kbOf(bridge)], bridge);
	git(["commit", "-qm", "hello"], bridge);
	const hero = findBridge(bridge)!;
	const doc = findKbDoc(hero.kbDir, id)!;
	const said: string[] = [];
	const say = { out: (text: string) => void said.push(text), err: (text: string) => void said.push(`err: ${text}`) };
	const cache = join(process.env.NOSEDIVE_USER_DIR!, "cache", `${id}.git`);
	return { bridge, source, id, hero, doc, said, say, cache, checkout: join(bridge, "workspace", "hello") };
}

test("checks a repo out detached at its trunk, a worktree of the user's cache, which owns the trunk, and leaves it once there", async () => {
	const { bridge, source, hero, doc, said, say, cache, checkout } = await hello("hydrate-repo");
	const first = hydrateRepo(hero, doc, say);
	assert.deepEqual(first, { dir: checkout, trunk: "trunk" });
	const head = git(["rev-parse", "--short", "HEAD"], source);
	assert.equal(said.at(-1), `workspace/hello: detached at trunk ${head}`);
	assert.equal(git(["rev-parse", "--path-format=absolute", "--git-common-dir"], checkout).toLowerCase(), cache.replace(/\\/g, "/").toLowerCase());
	assert.equal(git(["rev-parse", "--short", "refs/heads/trunk"], cache), head);
	assert.equal(git(["remote", "get-url", "origin"], checkout).toLowerCase(), source.toLowerCase());
	assert.match(spawnSync("git", ["push"], { cwd: checkout, encoding: "utf8" }).stderr, /not currently on a branch/);
	assert.doesNotMatch(git(["status", "--porcelain", "--untracked-files=all"], bridge), /workspace/, "the checkout is not committed");

	assert.deepEqual(hydrateRepo(hero, doc, say), first);
	assert.equal(said.at(-1), "workspace/hello: checked out already");
	assert.throws(() => hydrateRepo(hero, doc, say, { id: "f", workBranch: "work" }), /workspace\/hello is detached, not on \S+\/main\/f: dehydrate it first/);
});

test("checks a repo out for a feat on a branch named after the hero, its branch and the feat, tracking the work branch", async () => {
	const { source, hero, doc, said, say, cache, checkout } = await hello("hydrate-repo-feat");
	git(["checkout", "-q", "-b", "work"], source);
	git(["commit", "-q", "--allow-empty", "-m", "on work"], source);
	git(["checkout", "-q", "trunk"], source);
	hydrateRepo(hero, doc, say, { id: "feat-a", workBranch: "work" });
	const branch = `${hero.id}/main/feat-a`;
	assert.equal(git(["symbolic-ref", "--short", "HEAD"], checkout), branch);
	assert.equal(git(["log", "-1", "--format=%s"], checkout), "on work", "a new branch starts at the work branch on origin");
	assert.equal(git(["rev-parse", "--abbrev-ref", "@{upstream}"], checkout), "origin/work");
	assert.match(said.at(-1)!, new RegExp(`^workspace/hello: on ${branch} at \\w+$`));
	assert.throws(() => hydrateRepo(hero, doc, say), new RegExp(`is on ${branch}, not detached`));

	git(["worktree", "remove", checkout], cache);
	hydrateRepo(hero, doc, say, { id: "feat-b", workBranch: "none-yet" });
	assert.equal(git(["log", "-1", "--format=%s"], checkout), "first", "with no work branch on origin, it starts at trunk");
});

test("refuses a feat's checkout while the hero is detached", async () => {
	const { bridge, hero, doc, say, checkout } = await hello("hydrate-repo-detached-hero");
	git(["checkout", "-q", "--detach"], bridge);
	assert.throws(() => hydrateRepo(hero, doc, say, { id: "f", workBranch: "work" }), /the hero is detached/);
	assert.equal(existsSync(checkout), false);
});

test("goes on with the cache when origin cannot be reached, and refuses with no cache either", async () => {
	const { source, hero, doc, said, say, cache, checkout } = await hello("hydrate-repo-offline");
	renameSync(source, `${source}-gone`);
	assert.throws(() => hydrateRepo(hero, doc, say), /cannot fetch hello from .+, and there is no cache of it/);
	assert.equal(existsSync(cache), false, "no empty cache is left");
	renameSync(`${source}-gone`, source);
	hydrateRepo(hero, doc, say);
	git(["worktree", "remove", checkout], cache);

	renameSync(source, `${source}-gone`);
	const { trunk } = hydrateRepo(hero, doc, say);
	assert.equal(trunk, "trunk", "the trunk origin named when last fetched");
	assert.ok(said.some((line) => /^err: nosedive: cannot fetch hello from .+, so its cache is used as it is/.test(line)));
	assert.equal(git(["log", "-1", "--format=%s"], checkout), "first");
	renameSync(`${source}-gone`, source);
});

test("only fast-forwards the cache's trunk, and warns when it has moved apart from origin", async () => {
	const { hero, doc, said, say, cache, checkout } = await hello("hydrate-repo-apart");
	hydrateRepo(hero, doc, say);
	git(["commit", "-q", "--allow-empty", "-m", "only in the cache"], checkout);
	const apart = git(["rev-parse", "HEAD"], checkout);
	git(["update-ref", "refs/heads/trunk", apart], cache);
	git(["worktree", "remove", checkout], cache);
	hydrateRepo(hero, doc, say);
	assert.ok(said.includes("err: nosedive: hello's cache has a trunk its remote does not, so it was left as it is"));
	assert.equal(git(["rev-parse", "refs/heads/trunk"], cache), apart);
	assert.equal(git(["log", "-1", "--format=%s"], checkout), "first", "the checkout is at origin's tip");
});

test("tells a worktree of a cache with per-worktree config that it is no bare repo", async () => {
	const { source, hero, doc, say, cache, checkout } = await hello("hydrate-repo-worktree-config");
	git(["clone", "-q", "--bare", source, cache], source);
	git(["config", "extensions.worktreeConfig", "true"], cache);
	hydrateRepo(hero, doc, say);
	assert.equal(git(["status", "--porcelain"], checkout), "");
});

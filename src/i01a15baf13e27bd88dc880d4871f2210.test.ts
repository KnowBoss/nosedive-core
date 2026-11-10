// hydrate-repo
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a15baf13e27bd88dc880d4871f2210 as hydrateRepo, cachePath, remoteKey } from "./i01a15baf13e27bd88dc880d4871f2210.ts";
import { git, gitRepo, registerRepo, tempBridge, tempDir } from "../test/harness.ts";

/** A hero repo with repo `hello` registered and committed, its origin a repo of one commit on trunk. */
async function hello(label: string) {
	const bridge = await tempBridge(label);
	const source = gitRepo(`${label}-source`);
	git(["checkout", "-q", "-b", "trunk"], source);
	git(["commit", "-q", "--allow-empty", "-m", "first"], source);
	const id = await registerRepo(bridge, "hello", source);
	git(["add", ".nosedive/repos"], bridge);
	git(["commit", "-qm", "hello"], bridge);
	const hero = findBridge(bridge)!;
	const doc = findKbDoc(hero.reposDir!, id)!;
	const said: string[] = [];
	const say = { out: (text: string) => void said.push(text), err: (text: string) => void said.push(`err: ${text}`) };
	const cache = cachePath(source);
	const legacy = join(process.env.NOSEDIVE_USER_DIR!, "cache", `${id}.git`);
	return { bridge, source, id, hero, doc, said, say, cache, legacy, checkout: join(bridge, "workspace", "hello") };
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

const commonDir = (dir: string) => git(["rev-parse", "--path-format=absolute", "--git-common-dir"], dir).toLowerCase();
const slashed = (path: string) => path.replace(/\\/g, "/").toLowerCase();

test("spells a remote one way however it is written", () => {
	const key = remoteKey("https://github.com/KnowBoss/nosedive-dev.git");
	for (const spelling of ["git@github.com:KnowBoss/nosedive-dev.git", "git@GitHub.com:KnowBoss/nosedive-dev", "ssh://git@github.com/KnowBoss/nosedive-dev", "https://github.com/KnowBoss/nosedive-dev/"]) {
		assert.equal(remoteKey(spelling), key, spelling);
	}
	assert.notEqual(remoteKey("https://github.com/KnowBoss/nosedive"), key);
});

test("spells an Azure DevOps repo one way across its ssh, https and visualstudio.com forms, and a shape it does not know as itself", () => {
	const key = "dev.azure.com/org/some%20project/repo";
	for (const spelling of [
		"https://org@dev.azure.com/org/Some%20Project/_git/Repo",
		"git@ssh.dev.azure.com:v3/org/Some%20Project/Repo",
		"ssh://git@ssh.dev.azure.com/v3/org/Some%20Project/Repo",
		"https://org.visualstudio.com/Some%20Project/_git/Repo",
		"https://org.visualstudio.com/DefaultCollection/Some%20Project/_git/Repo",
		"org@vs-ssh.visualstudio.com:v3/org/Some%20Project/Repo",
	]) {
		assert.equal(remoteKey(spelling), key, spelling);
	}
	assert.equal(remoteKey("https://dev.azure.com/org/project/_git/repo/extra"), "dev.azure.com/org/project/_git/repo/extra");
	assert.equal(remoteKey("https://dev.azure.com/org/_git/repo"), "dev.azure.com/org/_git/repo");
});

test("names a cache by its origin's key's hash, under its host, _local for a path and _other for a host that is no plain name", () => {
	const root = join(process.env.NOSEDIVE_USER_DIR!, "cache");
	const hashed = (group: string, key: string) => join(root, group, `${createHash("sha256").update(key).digest("hex").slice(0, 16)}.git`);
	const keyed = hashed("github.com", "github.com/Owner/Name");
	assert.equal(cachePath("git@github.com:Owner/Name.git"), keyed);
	assert.equal(cachePath("https://GitHub.com/Owner/Name/"), keyed);
	assert.notEqual(cachePath("https://github.com/Owner/Other"), keyed);
	// Whatever the path holds, the name is a hash, so no cache lands inside another's directory.
	for (const odd of ["https://example.com/a/../b", "https://example.com/a/b%20c", "https://example.com/a.git/b", "https://org@dev.azure.com/org/Some%20Project/_git/repo"]) {
		assert.equal(cachePath(odd), hashed(remoteKey(odd).split("/")[0]!, remoteKey(odd)), odd);
	}
	for (const hostless of ["file:///some/repo", "https://[::1]/a/b"]) {
		assert.equal(cachePath(hostless), hashed("_other", remoteKey(hostless)), hostless);
	}
	assert.match(slashed(cachePath(join(root, "some", "path"))), /\/cache\/_local\/[0-9a-f]{16}\.git$/);
	assert.equal(slashed(cachePath("https://local/a/b")).includes("/cache/local/"), true, "a host named local is a host like any other");
	assert.equal(cachePath(join(root, "some", "path")), cachePath(`${join(root, "some", "path")}.git/`));
});

test("shares one cache between repo docs of different ids that name one origin", async () => {
	const { bridge, source, id, hero, doc, say, cache, checkout } = await hello("hydrate-repo-shared");
	const otherId = await registerRepo(bridge, "hello-again", source);
	assert.notEqual(otherId, id);
	const other = findKbDoc(hero.reposDir!, otherId)!;
	hydrateRepo(hero, doc, say);
	const { dir } = hydrateRepo(hero, other, say);
	assert.notEqual(dir, checkout);
	assert.equal(commonDir(checkout), slashed(cache));
	assert.equal(commonDir(dir), slashed(cache));
});

test("records the key a cache holds, and refuses a cache at its path that holds another", async () => {
	const { hero, doc, say, cache, checkout } = await hello("hydrate-repo-key-guard");
	hydrateRepo(hero, doc, say);
	const key = git(["config", "nosedive.key"], cache);
	assert.ok(key.length > 0);
	git(["worktree", "remove", checkout], cache);
	git(["config", "nosedive.key", "example.com/some/other"], cache);
	assert.throws(() => hydrateRepo(hero, doc, say), /hello's cache at .+ holds example\.com\/some\/other, not .+: move it aside to cache hello afresh/);
	assert.equal(existsSync(checkout), false);
});

test("moves a cache kept by repo doc id to its key, and its worktrees follow", async () => {
	const { source, hero, doc, said, say, cache, legacy, checkout } = await hello("hydrate-repo-legacy");
	git(["clone", "-q", "--bare", source, legacy], source);
	const worktree = join(tempDir("hydrate-repo-legacy-worktree"), "hello");
	git(["worktree", "add", "-q", "--detach", worktree, "refs/heads/trunk"], legacy);
	hydrateRepo(hero, doc, say);
	assert.equal(existsSync(legacy), false);
	assert.deepEqual(said.filter((line) => line.startsWith("err: ")), []);
	git(["status"], worktree);
	assert.equal(commonDir(worktree), slashed(cache));
	assert.equal(commonDir(checkout), slashed(cache));
});

test("warns, naming the cache, when git cannot repair the checkouts of a cache it moved", async () => {
	const { source, hero, doc, said, say, cache, legacy } = await hello("hydrate-repo-legacy-unrepaired");
	git(["clone", "-q", "--bare", source, legacy], source);
	const worktree = join(tempDir("hydrate-repo-legacy-unrepaired-worktree"), "hello");
	git(["worktree", "add", "-q", "--detach", worktree, "refs/heads/trunk"], legacy);
	// A .git file git cannot rewrite makes its repair fail.
	chmodSync(join(worktree, ".git"), 0o444);
	try {
		hydrateRepo(hero, doc, say);
	} finally {
		chmodSync(join(worktree, ".git"), 0o644);
	}
	assert.equal(existsSync(cache), true);
	assert.ok(said.some((line) => line.startsWith(`err: nosedive: hello's cache moved to ${cache}, but git could not repair its checkouts, which may still point at ${legacy}: `)), said.join("\n"));
});

test("leaves a cache kept by repo doc id where it is when one is at its key already, and warns naming it", async () => {
	const { source, hero, doc, said, say, cache, legacy, checkout } = await hello("hydrate-repo-legacy-left");
	hydrateRepo(hero, doc, say);
	git(["worktree", "remove", checkout], cache);
	git(["clone", "-q", "--bare", source, legacy], source);
	hydrateRepo(hero, doc, say);
	assert.equal(existsSync(legacy), true);
	assert.ok(said.some((line) => line.startsWith("err: nosedive: hello's old cache at ") && line.includes(legacy)));
	assert.equal(commonDir(checkout), slashed(cache));
});

// seed [--no-capes] [--root-kind <kind>]
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { test } from "node:test";
import { git, gitRepo, greetCapeRepo, ok, registerRepo, run, setActions, tempBridge, tempDir } from "./harness.ts";

test("makes a git repo a base by default, in one commit", async () => {
	const dir = gitRepo("seed");
	const repo = basename(dir);
	assert.equal(ok(await run(["seed"], dir)), `seeded ${repo}`);
	const config = readFileSync(join(dir, ".nosedive", "config.yaml"), "utf8");
	const root = /^root: (\S+)\n/m.exec(config)?.[1];
	assert.equal(config, `kb: ./kb\nroot: ${root}\n`);
	assert.match(readFileSync(join(dir, "kb", `${root}.md`), "utf8"), new RegExp(`^---\\nkind: base\\nid: ${root}\\nname: root\\n`));
	assert.equal(readFileSync(join(dir, ".nosedive", ".gitignore"), "utf8"), "capes/\nlocal/\n");
	assert.equal(existsSync(join(dir, ".gitignore")), false, "the repo's own .gitignore is the user's");
	assert.equal(git(["log", "--format=%s"], dir), `seed: ${repo} set up`);
	assert.equal(git(["status", "--porcelain"], dir), "");
});

test("any other root kind gets no workspace", async () => {
	const dir = gitRepo("seed-memo");
	ok(await run(["seed", "--root-kind", "memo"], dir));
	assert.equal(existsSync(join(dir, "workspace")), false, "only a base has a workspace");
});

test("leaves an existing bridge's config alone, and says it is seeded", async () => {
	const dir = gitRepo("seed-again");
	ok(await run(["seed"], dir));
	const config = join(dir, ".nosedive", "config.yaml");
	writeFileSync(config, `${readFileSync(config, "utf8")}custom: value # kept\n`);
	git(["commit", "-qam", "custom"], dir);
	const out = ok(await run(["seed"], dir));
	assert.equal(out, `${basename(dir)} is already seeded`);
	assert.match(readFileSync(config, "utf8"), /custom: value # kept\n/);
});

test("builds the capes config names, so their actions run", async () => {
	const bridge = await tempBridge("seed-capes");
	const repo = greetCapeRepo();
	await registerRepo(bridge, "greet-cape", repo);
	setActions(bridge, { greet: "greet-cape" });

	const missing = await run(["greet", "ann"], bridge);
	assert.equal(missing.code, 1);
	assert.match(missing.err, /greet needs the greet-cape cape at its trunk, built for this core: run `nosedive seed`/);

	const commit = git(["rev-parse", "HEAD"], repo);
	assert.match(ok(await run(["seed"], bridge)), new RegExp(`built cape greet-cape \\S+ \\(${commit.slice(0, 7)}\\) for greet`));
	assert.match(ok(await run(["greet", "ann"], bridge)), /^hello ann [0-9a-f-]{36}$/);
	assert.doesNotMatch(git(["status", "--porcelain", "--untracked-files=all"], bridge), /capes/, "built capes stay out of git");
});

test("builds a pinned commit once, and --no-capes builds nothing", async () => {
	const bridge = await tempBridge("seed-pinned");
	const repo = greetCapeRepo();
	await registerRepo(bridge, "greet-cape", repo);
	setActions(bridge, { greet: `greet-cape@${git(["rev-parse", "HEAD"], repo)}` });
	assert.doesNotMatch(ok(await run(["seed", "--no-capes"], bridge)), /cape/);
	assert.match(ok(await run(["seed"], bridge)), /built cape greet-cape@/);
	assert.match(ok(await run(["seed"], bridge)), /cape greet-cape@\S+ is built/);
	assert.match(ok(await run(["greet", "bo"], bridge)), /^hello bo /);
});

test("refuses outside a git repo", async () => {
	const result = await run(["seed"], tempDir("seed-no-git"));
	assert.equal(result.code, 1);
	assert.match(result.err, /not a git repo/);
});

test("--root-kind makes the root a declared kind, such as cape", async () => {
	const dir = gitRepo("seed-root-kind");
	ok(await run(["seed", "--root-kind", "cape"], dir));
	const root = /\nroot: (\S+)\n/.exec(readFileSync(join(dir, ".nosedive", "config.yaml"), "utf8"))?.[1];
	assert.match(readFileSync(join(dir, "kb", `${root}.md`), "utf8"), /^---\nkind: cape\n/);
	const undeclared = await run(["seed", "--root-kind", "ship"], gitRepo("seed-root-ship"));
	assert.equal(undeclared.code, 1);
	assert.match(undeclared.err, /no kind ship is declared, so it cannot be the root's kind/);
});

test("takes a config's backlog as its root, and adds no other", async () => {
	const dir = gitRepo("seed-backlog");
	writeFileSync(join(dir, ".gitignore"), "");
	ok(await run(["seed"], dir));
	const config = join(dir, ".nosedive", "config.yaml");
	writeFileSync(config, readFileSync(config, "utf8").replace(/^root: /m, "backlog: "));
	const before = readFileSync(config, "utf8");
	ok(await run(["seed"], dir));
	assert.equal(readFileSync(config, "utf8"), before);
});

test("a base gets a workspace that ignores itself, and moves it when its path changes", async () => {
	const base = gitRepo("seed-base");
	ok(await run(["seed", "--root-kind", "base"], base));
	const config = readFileSync(join(base, ".nosedive", "config.yaml"), "utf8");
	assert.doesNotMatch(config, /workspace/, "the workspace is the root's, not the config's");
	const root = join(base, "kb", `${/\nroot: (\S+)\n/.exec(config)![1]}.md`);
	assert.match(readFileSync(root, "utf8"), /\nmeta:\n {2}workspace: \.\/workspace\n/);
	assert.equal(readFileSync(join(base, "workspace", ".gitignore"), "utf8"), "*\n");
	assert.equal(existsSync(join(base, ".gitignore")), false, "the repo's own .gitignore is the user's");
	writeFileSync(join(base, "workspace", "clone.txt"), "checked out\n");
	assert.equal(git(["status", "--porcelain", "--untracked-files=all"], base), "");

	writeFileSync(root, readFileSync(root, "utf8").replace("workspace: ./workspace", "workspace: ./repos"));
	git(["commit", "-qam", "move the workspace"], base);
	ok(await run(["seed"], base));
	assert.equal(existsSync(join(base, "workspace")), false);
	assert.equal(readFileSync(join(base, "repos", "clone.txt"), "utf8"), "checked out\n", "moved, clones and all");

	const memo = gitRepo("seed-not-base");
	ok(await run(["seed", "--root-kind", "memo"], memo));
	await registerRepo(memo, "greet-cape", greetCapeRepo());
	const refused = await run(["test", "greet-cape"], memo);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /greet-cape cannot be checked out here: only a base has a workspace \(`nosedive seed --root-kind base`\)/);
});

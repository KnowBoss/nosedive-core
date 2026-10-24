// seed [--no-capes] [--root-kind <kind>]
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { test } from "node:test";
import { git, gitRepo, greetCapeRepo, ok, registerRepo, run, setCapes, tempBridge, tempDir } from "../test/harness.ts";

test("makes a git repo a ship by default, in one commit", async () => {
	const dir = gitRepo("seed");
	const repo = basename(dir);
	assert.equal(ok(await run(["seed"], dir)), `seeded ${repo}`);
	const config = readFileSync(join(dir, ".nosedive", "config.yaml"), "utf8");
	const root = /^ship: (\S+)\n/m.exec(config)?.[1];
	assert.equal(config, `kb: ./kb\nship: ${root}\n`);
	assert.equal(
		readFileSync(join(dir, "kb", `${root}.md`), "utf8"),
		`---\nkind: ship\nid: ${root}\nname: ${repo}\ngist: "What ${repo} holds"\nmeta:\n  workspace: ./workspace\n---\n\n# ${repo}\n`,
		"the root is named after the repo",
	);
	assert.equal(readFileSync(join(dir, ".nosedive", ".gitignore"), "utf8"), "cache/\ncapes/\nlocal/\n");
	assert.equal(readFileSync(join(dir, ".gitignore"), "utf8"), "!package-lock.json\n", "the repo's own .gitignore is the user's, but for its lockfile");
	assert.equal(git(["log", "--format=%s"], dir), `seed: ${repo} set up`);
	assert.equal(git(["status", "--porcelain"], dir), "");
});

test("any other root kind gets no workspace, and is named as root unless a cape or a base", async () => {
	const dir = gitRepo("seed-memo");
	ok(await run(["seed", "--root-kind", "memo"], dir));
	assert.equal(existsSync(join(dir, "workspace")), false, "only a ship has a workspace");
	assert.equal(existsSync(join(dir, ".gitignore")), false, "nor does it build packages");
	assert.match(readFileSync(join(dir, ".nosedive", "config.yaml"), "utf8"), /^root: /m);
	const base = gitRepo("seed-data");
	ok(await run(["seed", "--root-kind", "base"], base));
	assert.match(readFileSync(join(base, ".nosedive", "config.yaml"), "utf8"), /^base: /m, "a base is named by its kind");
	assert.equal(existsSync(join(base, "workspace")), false, "a base is data only");
	assert.equal(existsSync(join(base, ".gitignore")), false);
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
	setCapes(bridge, ["greet-cape"]);

	const missing = await run(["greet", "ann"], bridge);
	assert.equal(missing.code, 1);
	assert.match(missing.err, /unknown action: greet\n[^]*greet-cape\n {2}not built: run `nosedive seed`/);

	const commit = git(["rev-parse", "HEAD"], repo);
	assert.match(ok(await run(["seed"], bridge)), new RegExp(`built cape greet-cape \\S+ \\(${commit.slice(0, 7)}\\): greet`));
	assert.match(ok(await run(["greet", "ann"], bridge)), /^hello ann [0-9a-f-]{36}$/);
	assert.doesNotMatch(git(["status", "--porcelain", "--untracked-files=all"], bridge), /capes/, "built capes stay out of git");
});

test("builds a pinned commit once, and --no-capes builds nothing", async () => {
	const bridge = await tempBridge("seed-pinned");
	const repo = greetCapeRepo();
	await registerRepo(bridge, "greet-cape", repo);
	setCapes(bridge, [`greet-cape@${git(["rev-parse", "HEAD"], repo)}`]);
	assert.doesNotMatch(ok(await run(["seed", "--no-capes"], bridge)), /cape/);
	assert.match(ok(await run(["seed"], bridge)), /built cape greet-cape@/);
	assert.match(ok(await run(["seed"], bridge)), /cape greet-cape@\S+ is built/);
	assert.match(ok(await run(["greet", "bo"], bridge)), /^hello bo /);
});

test("builds every cape it can, then names each that failed and the core that last built it", async () => {
	const bridge = await tempBridge("seed-failing");
	await registerRepo(bridge, "greet-cape", greetCapeRepo());
	const broken = await registerRepo(bridge, "broken-cape", greetCapeRepo({ plain: true }));
	const manifest = join(bridge, ".nosedive", "capes", "manifest.json");
	mkdirSync(dirname(manifest), { recursive: true });
	const old = { id: "old", repo: broken, ref: "", commit: "c0ffee0000000000000000000000000000000000", core: "older-core", coreVersion: "2026.1.1-1" };
	writeFileSync(manifest, JSON.stringify([{ ...old, actions: {}, needs: {}, version: "v", builtAt: "2026-01-01T00:00:00.000Z" }]));
	setCapes(bridge, ["broken-cape", "greet-cape"]);

	const seeded = await run(["seed"], bridge);
	assert.equal(seeded.code, 1);
	assert.match(seeded.out, /built cape greet-cape /);
	assert.match(seeded.err, /- broken-cape: broken-cape is not a cape: it has no root\n {2}it last built at c0ffee0 with core 2026\.1\.1-1: pin it there, as `broken-cape@c0ffee0{34}` in config `capes`, or go back to that core/);
	assert.match(ok(await run(["greet", "ann"], bridge)), /^hello ann /, "the capes that built still run");
});

test("builds capes whose actions clash, and the launcher asks which, as <cape>:<action>", async () => {
	const bridge = await tempBridge("seed-clash");
	await registerRepo(bridge, "greet-cape", greetCapeRepo());
	await registerRepo(bridge, "other-greet", greetCapeRepo({ name: "other-greet" }));
	setCapes(bridge, ["greet-cape", "other-greet"]);
	ok(await run(["seed"], bridge));
	const ambiguous = await run(["greet", "ann"], bridge);
	assert.equal(ambiguous.code, 1);
	assert.match(ambiguous.err, /greet is an action of greet-cape and other-greet: name one, as `greet-cape:greet` or `other-greet:greet`/);
	assert.match(ok(await run(["other-greet:greet", "ann"], bridge)), /^hello ann /);
	assert.match((await run(["nosedive-core:greet", "ann"], bridge)).err, /nosedive-core has no action greet/);
	assert.match((await run(["nope:greet", "ann"], bridge)).err, /no cape nope in this ship's config `capes`/);
	assert.match(ok(await run(["nosedive-core:mint"], bridge)), /^[0-9a-f-]{36}$/, "core's own actions run under its name too");
});

test("refuses outside a git repo", async () => {
	const result = await run(["seed"], tempDir("seed-no-git"));
	assert.equal(result.code, 1);
	assert.match(result.err, /not a git repo/);
});

test("--root-kind makes the root a declared kind, such as cape", async () => {
	const dir = gitRepo("seed-root-kind");
	ok(await run(["seed", "--root-kind", "cape"], dir));
	const root = /\ncape: (\S+)\n/.exec(readFileSync(join(dir, ".nosedive", "config.yaml"), "utf8"))?.[1];
	assert.match(readFileSync(join(dir, "kb", `${root}.md`), "utf8"), /^---\nkind: cape\n/);
	// A cape's lockfile is committable even when an ignore outside the repo hides lockfiles.
	writeFileSync(join(dir, ".git", "info", "exclude"), "package-lock.json\n");
	writeFileSync(join(dir, "package-lock.json"), "{}\n");
	assert.equal(git(["status", "--porcelain", "package-lock.json"], dir), "?? package-lock.json");
	const undeclared = await run(["seed", "--root-kind", "galleon"], gitRepo("seed-root-galleon"));
	assert.equal(undeclared.code, 1);
	assert.match(undeclared.err, /no kind galleon is declared, so it cannot be the root's kind/);
});

test("takes a config's backlog as its root, and adds no other", async () => {
	const dir = gitRepo("seed-backlog");
	writeFileSync(join(dir, ".gitignore"), "");
	ok(await run(["seed"], dir));
	const config = join(dir, ".nosedive", "config.yaml");
	writeFileSync(config, readFileSync(config, "utf8").replace(/^ship: /m, "backlog: "));
	const before = readFileSync(config, "utf8");
	ok(await run(["seed"], dir));
	assert.equal(readFileSync(config, "utf8"), before);
});

test("a ship gets a workspace that ignores itself, and moves it when its path changes", async () => {
	const base = gitRepo("seed-ship");
	ok(await run(["seed"], base));
	const config = readFileSync(join(base, ".nosedive", "config.yaml"), "utf8");
	assert.doesNotMatch(config, /workspace/, "the workspace is the root's, not the config's");
	const root = join(base, "kb", `${/\nship: (\S+)\n/.exec(config)![1]}.md`);
	assert.match(readFileSync(root, "utf8"), /\nmeta:\n {2}workspace: \.\/workspace\n/);
	assert.equal(readFileSync(join(base, "workspace", ".gitignore"), "utf8"), "*\n");
	assert.doesNotMatch(readFileSync(join(base, ".gitignore"), "utf8"), /workspace/, "the workspace ignores itself, not through the repo's .gitignore");
	writeFileSync(join(base, "workspace", "clone.txt"), "checked out\n");
	assert.equal(git(["status", "--porcelain", "--untracked-files=all"], base), "");

	writeFileSync(root, readFileSync(root, "utf8").replace("workspace: ./workspace", "workspace: ./repos"));
	git(["commit", "-qam", "move the workspace"], base);
	ok(await run(["seed"], base));
	assert.equal(existsSync(join(base, "workspace")), false);
	assert.equal(readFileSync(join(base, "repos", "clone.txt"), "utf8"), "checked out\n", "moved, clones and all");

});

test("renders the root's tree from its feat links, and leaves it once rendered", async () => {
	const dir = await tempBridge("seed-tree");
	const root = /^ship: (\S+)$/m.exec(readFileSync(join(dir, ".nosedive", "config.yaml"), "utf8"))![1]!;
	const memo = ok(await run(["crud", "memo", "free", "level"], dir)).replace(/^.*\/|\.md$/g, "");
	ok(await run(["crud", root, "--links", "-"], dir, `kb/${memo}.md:\n  rel: levels.feat\n`));
	assert.match(ok(await run(["seed", "--no-capes"], dir)), /rendered the tree of /);
	assert.ok(readFileSync(join(dir, "kb", `${root}.md`), "utf8").endsWith(`\n## Levels\n\n- [free level](${memo}.md): free level\n`));
	assert.equal(git(["log", "-1", "--format=%s"], dir), `seed: ${basename(dir)} tree rendered`);
	assert.doesNotMatch(ok(await run(["seed", "--no-capes"], dir)), /rendered/);
});

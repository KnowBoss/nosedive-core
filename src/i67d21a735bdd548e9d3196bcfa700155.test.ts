// seed [--no-capes] [--root-kind <kind>] [--workspace]
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { test } from "node:test";
import { MIGRATIONS } from "./i01a175dbf4517dafa3a9048ecd98ab84.ts";
import { git, gitRepo, greetCapeRepo, ok, registerRepo, run, setCapes, tempBridge, tempDir } from "../test/harness.ts";

/** The id and roots a repo's config lists. */
function configOf(dir: string): { id: string; roots: string[]; text: string } {
	const text = readFileSync(join(dir, ".nosedive", "config.yaml"), "utf8");
	return { id: /^id: (\S+)$/m.exec(text)![1]!, roots: [...text.matchAll(/^ {2}- (\S+)$/gm)].map((match) => match[1]!), text };
}

test("makes a git repo a nosedive repo, its config naming its id and one root of kind root, in one commit", async () => {
	const dir = gitRepo("seed");
	const repo = basename(dir);
	assert.equal(ok(await run(["seed"], dir)), `seeded ${repo}`);
	const { id, roots, text } = configOf(dir);
	const root = roots[0]!.replace(/^kb\/|\.md$/g, "");
	assert.equal(text, `id: ${id}\nlast-migration: ${MIGRATIONS.at(-1)!.id}\nroots:\n  - kb/${root}.md\n`, "already in today's shape, and no workspace unless asked");
	assert.notEqual(id, root, "the repo's id is its own");
	assert.equal(readFileSync(join(dir, "kb", `${root}.md`), "utf8"), `---\nkind: root\nid: ${root}\nname: ${repo}\ngist: "What ${repo} holds"\n---\n\n# ${repo}\n`, "named after the repo");
	assert.equal(readFileSync(join(dir, ".nosedive", ".gitignore"), "utf8"), "cache/\ncapes/\nlocal/\n");
	assert.equal(existsSync(join(dir, ".gitignore")), false, "no workspace and no cape root, so no lockfile line");
	assert.equal(existsSync(join(dir, "workspace")), false);
	assert.equal(git(["log", "--format=%s"], dir), `seed: ${repo} set up`);
	assert.equal(git(["status", "--porcelain"], dir), "");
});

test("--workspace makes it able to do work, and a cape root keeps its lockfile committable too", async () => {
	const ship = gitRepo("seed-workspace");
	ok(await run(["seed", "--workspace"], ship));
	const { id, roots, text } = configOf(ship);
	assert.equal(text, `id: ${id}\nlast-migration: ${MIGRATIONS.at(-1)!.id}\nworkspace: ./workspace\nroots:\n  - ${roots[0]}\n`);
	assert.equal(readFileSync(join(ship, ".gitignore"), "utf8"), "!package-lock.json\n", "the repo's own .gitignore is the user's, but for its lockfile");
	const later = gitRepo("seed-workspace-later");
	ok(await run(["seed"], later));
	ok(await run(["seed", "--workspace"], later));
	assert.match(configOf(later).text, /^workspace: \.\/workspace$/m, "added to a repo that lacked one");
	assert.equal(existsSync(join(later, "workspace", ".gitignore")), true);
});

test("leaves an existing repo's config alone, and says it is seeded", async () => {
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

test("builds a pinned commit once, of a cape an older config names, and --no-capes builds nothing", async () => {
	const bridge = await tempBridge("seed-pinned");
	const repo = greetCapeRepo({ legacy: true });
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
	assert.match(readFileSync(join(dir, configOf(dir).roots[0]!), "utf8"), /^---\nkind: cape\n/);
	// A cape's lockfile is committable even when an ignore outside the repo hides lockfiles.
	writeFileSync(join(dir, ".git", "info", "exclude"), "package-lock.json\n");
	writeFileSync(join(dir, "package-lock.json"), "{}\n");
	assert.equal(git(["status", "--porcelain", "package-lock.json"], dir), "?? package-lock.json");
	const undeclared = await run(["seed", "--root-kind", "galleon"], gitRepo("seed-root-galleon"));
	assert.equal(undeclared.code, 1);
	assert.match(undeclared.err, /no kind galleon is declared, so it cannot be the root's kind/);
});

test("migrates an older config first, its backlog becoming its one root, and says so", async () => {
	const dir = gitRepo("seed-backlog");
	const root = ok(await run(["mint"], dir));
	mkdirSync(join(dir, "kb"));
	writeFileSync(join(dir, "kb", `${root}.md`), `---\nkind: memo\nid: ${root}\nname: old\n---\n\n# old\n`);
	mkdirSync(join(dir, ".nosedive"));
	const config = join(dir, ".nosedive", "config.yaml");
	writeFileSync(config, `kb: ./kb\nbacklog: ${root}\n`);
	git(["add", "-A"], dir);
	git(["commit", "-qm", "older"], dir);
	assert.match(ok(await run(["seed", "--no-capes"], dir)), new RegExp(`^migrated ${basename(dir)}: baseline$`, "m"));
	assert.equal(readFileSync(config, "utf8"), `id: ${root}\nroots:\n  - kb/${root}.md\nlast-migration: ${MIGRATIONS.at(-1)!.id}\n`);
	assert.match(readFileSync(join(dir, "kb", `${root}.md`), "utf8"), /\nkind: root\n/);
	assert.match(git(["log", "--format=%s"], dir), /\nmigrate: baseline\n/);
	assert.doesNotMatch(ok(await run(["seed", "--no-capes"], dir)), /migrated/, "once");
});

test("a workspace ignores itself, and moves when its path changes", async () => {
	const base = gitRepo("seed-ship");
	ok(await run(["seed", "--workspace"], base));
	const config = join(base, ".nosedive", "config.yaml");
	assert.equal(readFileSync(join(base, "workspace", ".gitignore"), "utf8"), "*\n");
	assert.doesNotMatch(readFileSync(join(base, ".gitignore"), "utf8"), /workspace/, "the workspace ignores itself, not through the repo's .gitignore");
	writeFileSync(join(base, "workspace", "clone.txt"), "checked out\n");
	assert.equal(git(["status", "--porcelain", "--untracked-files=all"], base), "");

	writeFileSync(config, readFileSync(config, "utf8").replace("workspace: ./workspace", "workspace: ./repos"));
	git(["commit", "-qam", "move the workspace"], base);
	ok(await run(["seed"], base));
	assert.equal(existsSync(join(base, "workspace")), false);
	assert.equal(readFileSync(join(base, "repos", "clone.txt"), "utf8"), "checked out\n", "moved, clones and all");
});

test("renders each root's tree from its feat links, and leaves it once rendered", async () => {
	const dir = await tempBridge("seed-tree");
	const root = configOf(dir).roots[0]!.replace(/^kb\/|\.md$/g, "");
	const memo = ok(await run(["crud", "memo", "free", "level"], dir)).replace(/^.*\/|\.md$/g, "");
	ok(await run(["crud", root, "--links", "-"], dir, `kb/${memo}.md:\n  rel: levels.feat\n`));
	assert.match(ok(await run(["seed", "--no-capes"], dir)), /rendered the tree of /);
	assert.ok(readFileSync(join(dir, "kb", `${root}.md`), "utf8").endsWith(`\n## Levels\n\n- [free level](${memo}.md): free level\n`));
	assert.equal(git(["log", "-1", "--format=%s"], dir), `seed: ${basename(dir)} tree rendered`);
	assert.doesNotMatch(ok(await run(["seed", "--no-capes"], dir)), /rendered/);
});

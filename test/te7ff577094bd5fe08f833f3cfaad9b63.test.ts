// seed [--no-capes]
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { git, gitRepo, greetCapeRepo, ok, registerRepo, run, setActions, tempBridge, tempDir } from "./harness.ts";

test("makes a git repo a bridge, in one commit", async () => {
	const dir = gitRepo("seed");
	const out = ok(await run(["seed"], dir));
	const bridge = /^seeded bridge (\S+)$/.exec(out)?.[1];
	assert.ok(bridge, out);
	const config = readFileSync(join(dir, ".nosedive", "config.yaml"), "utf8");
	const root = /\nbacklog: (\S+)\n/.exec(config)?.[1];
	assert.equal(config, `bridge: ${bridge}\nkb: ./kb\nbacklog: ${root}\n`);
	assert.match(readFileSync(join(dir, "kb", `${root}.md`), "utf8"), new RegExp(`^---\\nkind: memo\\nid: ${root}\\nname: root\\n`));
	assert.equal(readFileSync(join(dir, ".gitignore"), "utf8"), ".nosedive/capes/\nworkspace/\n");
	assert.equal(git(["log", "--format=%s"], dir), `seed: bridge ${bridge} set up`);
	assert.equal(git(["status", "--porcelain"], dir), "");
});

test("leaves an existing bridge's config alone, and says it is seeded", async () => {
	const dir = gitRepo("seed-again");
	ok(await run(["seed"], dir));
	const config = join(dir, ".nosedive", "config.yaml");
	writeFileSync(config, `${readFileSync(config, "utf8")}workspace: ./workspace # kept\n`);
	git(["commit", "-qam", "custom"], dir);
	const out = ok(await run(["seed"], dir));
	assert.match(out, /^bridge \S+ is already seeded$/);
	assert.match(readFileSync(config, "utf8"), /workspace: \.\/workspace # kept\n/);
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

// seed
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { git, gitRepo, ok, run, tempDir } from "./harness.ts";

test("makes a git repo a bridge, in one commit", async () => {
	const dir = gitRepo("seed");
	const out = ok(await run(["seed"], dir));
	const bridge = /^seeded bridge (\S+)$/.exec(out)?.[1];
	assert.ok(bridge, out);
	assert.equal(readFileSync(join(dir, ".nosedive", "config.yaml"), "utf8"), `bridge: ${bridge}\nkb: ./kb\n`);
	assert.equal(readFileSync(join(dir, ".gitignore"), "utf8"), ".nosedive/capes/\n");
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

test("says capes are not built yet when config names actions", async () => {
	const dir = gitRepo("seed-actions");
	ok(await run(["seed"], dir));
	const config = join(dir, ".nosedive", "config.yaml");
	writeFileSync(config, `${readFileSync(config, "utf8")}actions:\n  helm: nosedive-helm\n`);
	assert.match(ok(await run(["seed"], dir)), /building capes is not in this prototype yet: helm/);
});

test("refuses outside a git repo", async () => {
	const result = await run(["seed"], tempDir("seed-no-git"));
	assert.equal(result.code, 1);
	assert.match(result.err, /not a git repo/);
});

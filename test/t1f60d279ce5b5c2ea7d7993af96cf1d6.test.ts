// cape <remote> [--ref <ref>]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { git, greetCapeRepo, ok, run, tempBridge, waveCapeRepo } from "./harness.ts";

const config = (bridge: string) => readFileSync(join(bridge, ".nosedive", "config.yaml"), "utf8");

test("registers the cape by its root's name, builds it, lists it in config, and commits", async () => {
	const bridge = await tempBridge("cape-add");
	const repo = greetCapeRepo();
	const commit = git(["rev-parse", "HEAD"], repo);
	const out = ok(await run(["cape", repo], bridge));
	assert.match(out, new RegExp(`^added cape greet-cape \\S+ \\(${commit.slice(0, 7)}\\)\n  greet  Greets$`));
	assert.match(config(bridge), /\ncapes:\n {2}- greet-cape\n/);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), "cape: added greet-cape");
	assert.equal(git(["status", "--porcelain"], bridge), "");
	const doc = git(["show", "--name-only", "--format=", "HEAD"], bridge).split("\n").find((file) => file.startsWith("kb/"))!;
	assert.match(readFileSync(join(bridge, doc), "utf8"), /^kind: repo\n[^]*\nname: greet-cape\n[^]*\n {2}remotes:\n {4}cloud: /m);
	assert.match(ok(await run(["greet", "ann"], bridge)), /^hello ann /);
});

test("--ref pins the cape where config lists it", async () => {
	const bridge = await tempBridge("cape-add-ref");
	const repo = greetCapeRepo();
	const commit = git(["rev-parse", "HEAD"], repo);
	ok(await run(["cape", repo, "--ref", commit], bridge));
	assert.match(config(bridge), new RegExp(`\ncapes:\n {2}- greet-cape@${commit}\n`));
});

test("refuses a repo that is not a cape, one already listed or registered elsewhere, and one that clashes, changing nothing", async () => {
	const bridge = await tempBridge("cape-add-refused");
	const head = git(["rev-parse", "HEAD"], bridge);
	const plain = await run(["cape", greetCapeRepo({ plain: true })], bridge);
	assert.equal(plain.code, 1);
	assert.match(plain.err, /is not a cape: it has no root/);
	assert.equal(git(["rev-parse", "HEAD"], bridge), head);

	const greet = greetCapeRepo();
	ok(await run(["cape", greet], bridge));
	assert.match((await run(["cape", greet], bridge)).err, /greet-cape is already in config `capes`/);
	assert.match((await run(["cape", greetCapeRepo()], bridge)).err, /a repo named greet-cape is already registered, cloned from /);

	const before = git(["rev-parse", "HEAD"], bridge);
	const clash = await run(["cape", greetCapeRepo({ name: "other-greet" })], bridge);
	assert.equal(clash.code, 1);
	assert.match(clash.err, /other-greet clashes, so it was not added:\n {2}greet is provided by greet-cape and other-greet/);
	assert.equal(git(["rev-parse", "HEAD"], bridge), before);
	assert.doesNotMatch(config(bridge), /other-greet/);
});

test("builds the capes a cape imports, by the repo docs the bridge has", async () => {
	const bridge = await tempBridge("cape-add-imports");
	ok(await run(["cape", greetCapeRepo()], bridge));
	ok(await run(["cape", "greet-cape", "--drop"], bridge));
	assert.match(ok(await run(["cape", waveCapeRepo()], bridge)), /\n {2}wave {2}Waves$/);
	assert.match(ok(await run(["wave", "bo"], bridge)), /^hello bo [0-9a-f-]{36}\nand waves$/);
});

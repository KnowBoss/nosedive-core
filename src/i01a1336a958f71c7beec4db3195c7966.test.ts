// launch
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { consoleCtx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { greetCapeRepo, ok, registerRepo, run, setCapes, tempBridge, tempDir } from "../test/harness.ts";

test("lists core's top-level actions, never internal functions", async () => {
	const out = ok(await run([], tempDir("launch-help")));
	assert.match(out, /^Usage: nosedive \[--base <base>\] <action> \[<args>\]\n\ncore \S+\n {2}crud {2}Reads, mints and edits kb docs\n {2}mint {2}Prints new uuid v7 ids/);
	assert.match(out, /\n {2}scaf {2}Writes the files/);
	assert.match(out, /\n {2}seed {2}Makes the current git repo a bridge/);
	assert.doesNotMatch(out, /match-usage|launch/);
});

test("lists the actions of the capes config names under each cape, once built, from the manifest", async () => {
	const bridge = await tempBridge("launch-help-capes");
	await registerRepo(bridge, "greet-cape", greetCapeRepo());
	setCapes(bridge, ["greet-cape"]);
	assert.match(ok(await run(["help"], bridge)), /\n\ngreet-cape\n {2}not built: run `nosedive seed`\n/);
	ok(await run(["seed"], bridge));
	const help = ok(await run(["help"], bridge));
	assert.match(help, /\n\ngreet-cape \S+\n {2}greet {2}Greets\n/);
	assert.match(ok(await run(["--help", "--more"], bridge)), /\n\ngreet-cape \S+\n {2}trunk at [0-9a-f]{12}, repo [0-9a-f-]{36}\n {2}greet {2}Greets\n/);
	assert.doesNotMatch(help, /not built/);
});

test("heads a cape in help by its short name, the name of its root doc, not its repo's", async () => {
	const bridge = await tempBridge("launch-help-short");
	await registerRepo(bridge, "greet-cape", greetCapeRepo({ name: "greet" }));
	setCapes(bridge, ["greet-cape"]);
	ok(await run(["seed"], bridge));
	assert.match(ok(await run(["help"], bridge)), /\n\ngreet \S+\n {2}greet {2}Greets\n/);
	assert.doesNotMatch(ok(await run(["help"], bridge)), /\n\ngreet-cape/);
});

test("--help lists an action's usages and names --help --more, which adds its ## Usage section", async () => {
	const dir = tempDir("launch-action-help");
	const help = ok(await run(["scaf", "--help"], dir));
	assert.equal(help, "Writes the files a cape's action docs call for and do not have yet\n\n  scaf [<quid>]\n\nnosedive scaf --help --more for what each usage does.");
	assert.match(ok(await run(["scaf", "--help", "--more"], dir)), /\n\nRun in a cape or a hero repo: /);
});

test("--base selects one of the hero's roots by directory, name or quid, else a directory in the hero for crud to write into; NOSEDIVE_HERO names the repo to act on", async () => {
	const bridge = await tempBridge("launch-base");
	try {
		assert.match((await run(["--base", "nope", "help"], bridge)).err, /--base names one of the hero's roots, by quid, name or directory, or a directory in the hero or its workspace, and nope is none/);
		assert.match((await run(["--base", "..", "help"], bridge)).err, /and \.\. is none/, "a directory outside the hero");
		assert.match(ok(await run(["--base", "kb", "crud", "core:memo", "Home"], bridge)), /^kb\//);
		const home = findBridge(bridge)!;
		assert.equal(home.baseDir, home.kbDir);
		mkdirSync(join(bridge, "notes"));
		assert.match(ok(await run(["--base", "notes", "crud", "core:memo", "Apart"], bridge)), /^notes\/[0-9a-f-]{36}\.md$/);
		assert.equal(process.env.NOSEDIVE_BASE, undefined, "--base holds for one command line");
		process.env.NOSEDIVE_BASE = join(bridge, "notes");
		const plain = findBridge(bridge)!;
		assert.deepEqual([plain.baseDir, plain.base], [join(bridge, "notes"), home.root], "a plain directory is written to, and the home base's capes are worn");
	} finally {
		delete process.env.NOSEDIVE_BASE;
	}
	const before = process.env.NOSEDIVE_HERO;
	process.env.NOSEDIVE_HERO = bridge;
	try {
		assert.equal(consoleCtx([]).cwd, bridge);
	} finally {
		if (before === undefined) delete process.env.NOSEDIVE_HERO;
		else process.env.NOSEDIVE_HERO = before;
	}
});

test("refuses an unknown action, and an internal function by name", async () => {
	const dir = tempDir("launch-unknown");
	for (const name of ["nope", "match-usage"]) {
		const result = await run([name], dir);
		assert.equal(result.code, 1);
		assert.match(result.err, new RegExp(`^nosedive: unknown action: ${name}\n`));
	}
});

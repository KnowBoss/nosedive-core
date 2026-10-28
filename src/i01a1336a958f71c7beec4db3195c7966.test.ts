// launch
import assert from "node:assert/strict";
import { test } from "node:test";
import { greetCapeRepo, ok, registerRepo, run, setCapes, tempBridge, tempDir } from "../test/harness.ts";

test("lists core's top-level actions, never internal functions", async () => {
	const out = ok(await run([], tempDir("launch-help")));
	assert.match(out, /^Usage: nosedive <action> \[<args>\]\n\nnosedive-core\n {2}cape {2}Lists the capes this bridge uses, adds one from its remote, or drops one\n {2}crud {2}Reads, mints and edits kb docs\n {2}mint {2}Prints new uuid v7 ids/);
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
	assert.match(help, /\n\ngreet-cape\n {2}greet {2}Greets\n/);
	assert.doesNotMatch(help, /not built/);
});

test("--help lists an action's usages, --more adds its body", async () => {
	const dir = tempDir("launch-action-help");
	const help = ok(await run(["scaf", "--help"], dir));
	assert.equal(help, "Writes the files a cape's action docs call for and do not have yet\n\n  scaf [<quid>]");
	assert.match(ok(await run(["scaf", "--more"], dir)), /\n\n# Scaf\n\nRun in a cape or a hero repo: /);
});

test("refuses an unknown action, and an internal function by name", async () => {
	const dir = tempDir("launch-unknown");
	for (const name of ["nope", "match-usage"]) {
		const result = await run([name], dir);
		assert.equal(result.code, 1);
		assert.match(result.err, new RegExp(`^nosedive: unknown action: ${name}\n`));
	}
});

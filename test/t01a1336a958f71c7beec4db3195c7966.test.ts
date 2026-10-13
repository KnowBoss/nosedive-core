// launch
import assert from "node:assert/strict";
import { test } from "node:test";
import { greetCapeRepo, ok, registerRepo, run, setActions, tempBridge, tempDir } from "./harness.ts";

test("lists core's top-level actions, never internal functions", async () => {
	const out = ok(await run([], tempDir("launch-help")));
	assert.match(out, /^Usage: nosedive <action> \[<args>\]\n\n {2}mint {2}Prints new uuid v7 ids/);
	assert.match(out, /\n {2}scaf {2}Writes the files/);
	assert.match(out, /\n {2}seed {2}Makes the current git repo a bridge/);
	assert.doesNotMatch(out, /match-usage|launch/);
});

test("lists the actions config names, from their capes once built", async () => {
	const bridge = await tempBridge("launch-help-capes");
	await registerRepo(bridge, "greet-cape", greetCapeRepo());
	setActions(bridge, { greet: "greet-cape" });
	assert.match(ok(await run(["help"], bridge)), /\n {2}greet {2}not built: run `nosedive seed`\n/);
	ok(await run(["seed"], bridge));
	assert.match(ok(await run(["help"], bridge)), /\n {2}greet {2}Greets \(greet-cape\)\n/);
});

test("never lets config shadow a core action", async () => {
	const bridge = await tempBridge("launch-shadow");
	await registerRepo(bridge, "greet-cape", greetCapeRepo());
	setActions(bridge, { scaf: "greet-cape" });
	const help = ok(await run(["help"], bridge));
	assert.match(help, /\n {2}scaf {2}Writes the files/);
	assert.doesNotMatch(help, /not built/);
	const seeded = await run(["seed"], bridge);
	assert.equal(seeded.code, 1);
	assert.match(seeded.err, /config actions cannot replace core's own: remove scaf from /);
});

test("--help lists an action's usages, --more adds its body", async () => {
	const dir = tempDir("launch-action-help");
	const help = ok(await run(["scaf", "--help"], dir));
	assert.equal(help, "Writes the files a cape repo's action docs call for and do not have yet\n\n  scaf [<quid>]");
	assert.match(ok(await run(["scaf", "--more"], dir)), /\n\n# Scaf\n\nRun in a cape repo\./);
});

test("refuses an unknown action, and an internal function by name", async () => {
	const dir = tempDir("launch-unknown");
	for (const name of ["nope", "match-usage"]) {
		const result = await run([name], dir);
		assert.equal(result.code, 1);
		assert.match(result.err, new RegExp(`^nosedive: unknown action: ${name}\n`));
	}
});

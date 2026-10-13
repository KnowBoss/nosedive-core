// launch
import assert from "node:assert/strict";
import { test } from "node:test";
import { ok, run, tempDir } from "./harness.ts";

test("lists user actions, never internal functions", async () => {
	const out = ok(await run([], tempDir("launch-help")));
	assert.match(out, /^Usage: nosedive <action> \[<args>\]\n\n {2}crud {2}Reads, mints and edits kb docs\n/);
	assert.doesNotMatch(out, /match-usage|launch/);
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

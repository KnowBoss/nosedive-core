// cape <name> --drop
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { git, greetCapeRepo, ok, run, tempBridge } from "./harness.ts";

test("takes the cape out of config and commits, keeping its repo doc", async () => {
	const bridge = await tempBridge("cape-drop");
	ok(await run(["cape", greetCapeRepo()], bridge));
	const docs = git(["ls-files", "kb"], bridge);
	assert.equal(ok(await run(["cape", "greet-cape", "--drop"], bridge)), "dropped cape greet-cape");
	assert.doesNotMatch(readFileSync(join(bridge, ".nosedive", "config.yaml"), "utf8"), /capes/);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), "cape: dropped greet-cape");
	assert.equal(git(["ls-files", "kb"], bridge), docs);
	assert.match((await run(["greet", "ann"], bridge)).err, /unknown action: greet/);
});

test("refuses a cape config does not list", async () => {
	const result = await run(["cape", "greet-cape", "--drop"], await tempBridge("cape-drop-unknown"));
	assert.equal(result.code, 1);
	assert.match(result.err, /greet-cape is not in config `capes`/);
});

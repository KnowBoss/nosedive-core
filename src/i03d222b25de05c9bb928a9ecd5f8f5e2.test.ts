// cape
import assert from "node:assert/strict";
import { test } from "node:test";
import { greetCapeRepo, ok, registerRepo, run, setCapes, tempBridge } from "../test/harness.ts";

test("says when there are no capes", async () => {
	assert.equal(ok(await run(["cape"], await tempBridge("cape-list-none"))), "no capes: add one with `nosedive cape <remote>`");
});

test("lists each configured cape, with its build's actions or that it is not built", async () => {
	const bridge = await tempBridge("cape-list");
	await registerRepo(bridge, "greet-cape", greetCapeRepo());
	setCapes(bridge, ["greet-cape"]);
	assert.equal(ok(await run(["cape"], bridge)), "greet-cape: not built, run `nosedive seed`");
	ok(await run(["seed"], bridge));
	const lines = ok(await run(["cape"], bridge)).split(String.fromCharCode(10));
	assert.match(lines[0]!, /^greet-cape \S+ [(]\w{7}[)]$/);
	assert.deepEqual(lines.slice(1), ["  greet  Greets"]);
});

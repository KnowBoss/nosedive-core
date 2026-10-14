// test <ref>
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { git, greetCapeRepo, ok, CAPE_TESTS_PASS, registerRepo, run, tempBridge, waveCapeRepo } from "./harness.ts";

test("checks a repo out and runs its root's test gates, by name or by its repo doc", async () => {
	const bridge = await tempBridge("test-repo");
	const source = greetCapeRepo({ gated: true });
	const id = await registerRepo(bridge, "greet-cape", source);
	const out = ok(await run(["test", "greet-cape"], bridge));
	assert.match(out, new RegExp(`^workspace/greet-cape: cloned main at ${git(["rev-parse", "--short", "HEAD"], source)}\n`));
	assert.match(out, /\ngate cape-tests-pass:\n[\s\S]*✔ greet <who>[\s\S]*\ngate cape-tests-pass: passed$/);
	assert.match(ok(await run(["test", id], bridge)), /^workspace\/greet-cape: checked out already\n/);
});

test("tests the checkout as it is, beside the capes it imports", async () => {
	const bridge = await tempBridge("test-capes");
	git(["clone", "-q", greetCapeRepo(), join(bridge, "workspace", "greet-cape")], bridge);
	await registerRepo(bridge, "wave-cape", waveCapeRepo({ gated: true }));
	assert.match(ok(await run(["test", "wave-cape"], bridge)), /✔ wave <who>[\s\S]*gate cape-tests-pass: passed$/);
});

test("fails when the repo's tests fail, and refuses a repo that is no bridge", async () => {
	const bridge = await tempBridge("test-failing");
	await registerRepo(bridge, "greet-cape", greetCapeRepo({ gated: true, failing: true }));
	const failed = await run(["test", "greet-cape"], bridge);
	assert.equal(failed.code, 1);
	assert.match(failed.out, /gate cape-tests-pass: failed: the tests of greet-cape failed/);
	assert.match(failed.err, /1 of 1 test gates failed: cape-tests-pass/);

	await registerRepo(bridge, "plain-cape", greetCapeRepo({ plain: true }));
	const plain = await run(["test", "plain-cape"], bridge);
	assert.equal(plain.code, 1);
	assert.match(plain.err, /plain-cape is not a bridge with a root, so nothing links test gates for it/);
});

test("runs a doc's own test gates against the repo it lives in", async () => {
	const bridge = await tempBridge("test-doc");
	const doc = "01a1335b-f253-7b80-ab64-d2f9a03c9634";
	writeFileSync(join(bridge, "kb", `${doc}.md`), `---\nkind: memo\nid: ${doc}\nname: gated\n---\n`);
	assert.equal(ok(await run(["test", doc], bridge)), "gated links no test.gate");
	writeFileSync(join(bridge, "kb", `${doc}.md`), `---\nkind: memo\nid: ${doc}\nname: gated\nlinks:\n  - nosedive-core:${CAPE_TESTS_PASS}:\n      rel: test.gate\n---\n`);
	const result = await run(["test", doc], bridge);
	assert.match(result.out, /^gate cape-tests-pass:\ngate cape-tests-pass: failed: \S+ has no tests in test\/$/, "the gate runs against the bridge, which has none");
	assert.equal(result.code, 1);
});

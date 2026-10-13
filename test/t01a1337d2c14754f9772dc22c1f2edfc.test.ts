// find-repo-doc
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "../src/a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "../src/a01a1337d2c14754f9772dc22c1f2edfc.ts";
import { ok, registerRepo, run, tempBridge } from "./harness.ts";

test("finds a repo by name, resolving a relative remote against the bridge", async () => {
	const dir = await tempBridge("find-repo-doc");
	const id = await registerRepo(dir, "greet-cape", "../elsewhere");
	const bridge = findBridge(dir)!;
	assert.deepEqual(findRepoDoc(bridge, "greet-cape"), { id, name: "greet-cape", remote: join(dir, "..", "elsewhere") });
	const url = await registerRepo(dir, "cloud-cape", "https://github.com/sycdan/nosedive-core.git");
	assert.equal(findRepoDoc(findBridge(dir)!, "cloud-cape").remote, "https://github.com/sycdan/nosedive-core.git");
	assert.ok(url);
});

test("refuses an unknown repo, and one with nothing to clone from", async () => {
	const dir = await tempBridge("find-repo-doc-refuse");
	assert.throws(() => findRepoDoc(findBridge(dir)!, "nope"), /no repo named nope/);
	ok(await run(["crud", "repo", "bare", "--name", "bare"], dir));
	assert.throws(() => findRepoDoc(findBridge(dir)!, "bare"), /repo bare \(\S+\) has no meta\.remotes/);
});

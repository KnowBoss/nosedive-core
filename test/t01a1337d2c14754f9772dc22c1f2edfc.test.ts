// find-repo-doc
import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "../src/i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "../src/i01a1337d2c14754f9772dc22c1f2edfc.ts";
import { i01a14ac0044f7142a4623b2b7eff2eb5 as homeCopy } from "../src/i01a14ac0044f7142a4623b2b7eff2eb5.ts";
import { registerRepo, tempBridge } from "./harness.ts";

test("finds a repo by name, resolving a relative remote against the bridge", async () => {
	const dir = await tempBridge("find-repo-doc");
	const id = await registerRepo(dir, "greet-cape", "../elsewhere");
	await registerRepo(dir, "cloud-cape", "https://github.com/sycdan/nosedive-core.git");
	const bridge = findBridge(dir)!;
	assert.deepEqual(findRepoDoc(bridge, "greet-cape"), { id, name: "greet-cape", remote: join(dir, "..", "elsewhere") });
	assert.equal(findRepoDoc(bridge, "cloud-cape").remote, "https://github.com/sycdan/nosedive-core.git");
});

test("refuses an unknown repo, and one with nothing to clone from", async () => {
	const dir = await tempBridge("find-repo-doc-refuse");
	assert.throws(() => findRepoDoc(findBridge(dir)!, "nope"), /no repo named nope/);
	await registerRepo(dir, "bare");
	assert.throws(() => findRepoDoc(findBridge(dir)!, "bare"), /repo bare \(\S+\) has no meta\.remotes, and the bridge no `home`, to clone from/);
});

test("clones a repo with no remotes from its home copy", async () => {
	const dir = await tempBridge("find-repo-doc-home");
	await registerRepo(dir, "bare");
	appendFileSync(join(dir, ".nosedive", "config.yaml"), "home: ../homes\n");
	const bridge = findBridge(dir)!;
	assert.equal(findRepoDoc(bridge, "bare").remote, homeCopy(bridge, "bare"));
	assert.equal(dirname(findRepoDoc(bridge, "bare").remote), join(dir, "..", "homes"));
});

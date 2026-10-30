// find-repo-doc
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./i01a1337d2c14754f9772dc22c1f2edfc.ts";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "./i01a1335480c776ba8945020d0af333eb.ts";
import { kbOf, registerRepo, tempBridge } from "../test/harness.ts";

test("finds a repo by name, resolving a relative origin against the bridge", async () => {
	const dir = await tempBridge("find-repo-doc");
	const id = await registerRepo(dir, "greet-cape", "../elsewhere");
	await registerRepo(dir, "cloud-cape", "https://github.com/sycdan/nosedive-core.git");
	const bridge = findBridge(dir)!;
	assert.deepEqual(findRepoDoc(bridge, "greet-cape"), { id, name: "greet-cape", remote: join(dir, "..", "elsewhere") });
	assert.equal(findRepoDoc(bridge, "cloud-cape").remote, "https://github.com/sycdan/nosedive-core.git");
});

test("refuses an unknown repo, and one with no origin", async () => {
	const dir = await tempBridge("find-repo-doc-refuse");
	assert.throws(() => findRepoDoc(findBridge(dir)!, "nope"), /no repo named nope/);
	const id = mintUuid();
	mkdirSync(join(dir, ".nosedive", "repos"), { recursive: true });
	writeFileSync(join(dir, ".nosedive", "repos", `${id}.md`), `---\nkind: repo\nid: ${id}\nname: other\nmeta:\n  remotes:\n    cloud: https://example.com/other.git\n---\n`);
	assert.throws(() => findRepoDoc(findBridge(dir)!, "other"), /repo other \(\S+\) has no meta\.remotes\.origin to clone from/);
});

test("registered repos are identified by place, ignoring root kind and root-kb decoys", async () => {
	const dir = await tempBridge("find-repo-doc-place");
	const id = await registerRepo(dir, "registered", "../origin");
	const path = join(dir, ".nosedive", "repos", `${id}.md`);
	writeFileSync(path, readFileSync(path, "utf8").replace("kind: repo", "kind: idea"));
	assert.equal(findRepoDoc(findBridge(dir)!, "registered").id, id);
	const decoy = mintUuid();
	writeFileSync(join(kbOf(dir), `${decoy}.md`), `---\nkind: repo\nid: ${decoy}\nname: decoy\nmeta:\n  remotes:\n    origin: ../decoy\n---\n`);
	assert.throws(() => findRepoDoc(findBridge(dir)!, "decoy"), /no repo named decoy/);
});
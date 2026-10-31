// locate-kb-doc
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { checkedOut, git, kbOf, ok, run, tempBridge } from "../test/harness.ts";

const HERE = "01a1335b-f253-7b80-ab64-d2f9a03c9634";
const THERE = "01a1335b-f30a-7dd2-a1d4-b675fd419238";

test("looks in the bridge, then each workspace repo, a repo of data wherever git tracks the doc, naming the repo it found the doc in", async () => {
	const dir = await tempBridge("locate-kb-doc");
	const repo = checkedOut(dir, "other");
	writeFileSync(join(kbOf(dir), `${HERE}.md`), `---\nid: ${HERE}\n---\n`);
	mkdirSync(join(repo, "notes", "deep"), { recursive: true });
	writeFileSync(join(repo, "notes", "deep", `${THERE}.md`), `---\nid: ${THERE}\n---\n`);
	const bridge = findBridge(dir)!;
	assert.equal(locateKbDoc(bridge, HERE)?.repoDir, dir);
	assert.equal(locateKbDoc(bridge, THERE), undefined, "untracked");
	git(["add", "-A"], repo);
	assert.deepEqual([locateKbDoc(bridge, THERE)?.repoDir, locateKbDoc(bridge, THERE)?.kbDir], [repo, join(repo, "notes", "deep")]);
	assert.equal(locateKbDoc(bridge, "01a1335b-f3bd-7ef4-9eb1-98115e3ba276"), undefined);
});

test("finds a doc of a local cape, naming the hero as the repo it commits in", async () => {
	const dir = await tempBridge("locate-kb-doc-local");
	ok(await run(["--at", "capes/spec", "seed", "--root-kind", "cape"], dir));
	const root = readRepoConfig(join(dir, "capes", "spec"))!;
	const found = locateKbDoc(findBridge(dir)!, root.root!);
	assert.deepEqual([found?.repoDir, found?.kbDir], [dir, join(dir, "capes", "spec", "kb")]);
});

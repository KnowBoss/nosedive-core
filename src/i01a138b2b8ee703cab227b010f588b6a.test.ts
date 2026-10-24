// locate-kb-doc
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { checkedOut, tempBridge } from "../test/harness.ts";

const HERE = "01a1335b-f253-7b80-ab64-d2f9a03c9634";
const THERE = "01a1335b-f30a-7dd2-a1d4-b675fd419238";

test("looks in the bridge, then each workspace repo, naming the repo it found the doc in", async () => {
	const dir = await tempBridge("locate-kb-doc");
	const repo = checkedOut(dir, "other");
	writeFileSync(join(dir, "kb", `${HERE}.md`), `---\nid: ${HERE}\n---\n`);
	writeFileSync(join(repo, "kb", `${THERE}.md`), `---\nid: ${THERE}\n---\n`);
	const bridge = findBridge(dir)!;
	assert.equal(locateKbDoc(bridge, HERE)?.repoDir, dir);
	assert.equal(locateKbDoc(bridge, THERE)?.repoDir, repo);
	assert.equal(locateKbDoc(bridge, "01a1335b-f3bd-7ef4-9eb1-98115e3ba276"), undefined);
});

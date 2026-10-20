// hydrate-repo
import assert from "node:assert/strict";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a15baf13e27bd88dc880d4871f2210 as hydrateRepo } from "./i01a15baf13e27bd88dc880d4871f2210.ts";
import { git, gitRepo, registerRepo, tempBridge } from "../test/harness.ts";

test("checks a repo out and names its trunk, the source's HEAD branch when the doc names none, and leaves it once there", async () => {
	const bridge = await tempBridge("hydrate-repo");
	const source = gitRepo("hydrate-repo-source");
	git(["checkout", "-q", "-b", "trunk"], source);
	git(["commit", "-q", "--allow-empty", "-m", "first"], source);
	const id = await registerRepo(bridge, "hello", source);
	const ship = findBridge(bridge)!;
	const doc = findKbDoc(ship.kbDir, id)!;
	const said: string[] = [];
	const say = { out: (text: string) => void said.push(text), err: (text: string) => void said.push(text) };
	const first = hydrateRepo(ship, doc, say);
	assert.equal(first.trunk, "trunk");
	assert.equal(git(["rev-parse", "HEAD"], first.dir), git(["rev-parse", "HEAD"], source));
	assert.deepEqual(hydrateRepo(ship, doc, say), first);
	assert.match(said.at(-1)!, /workspace\/hello: checked out already/);
});

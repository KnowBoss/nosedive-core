// hydrate-repo
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "../src/a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a138b2b8f0793495b66bc7935c93be as hydrateRepo } from "../src/a01a138b2b8f0793495b66bc7935c93be.ts";
import { git, greetCapeRepo, registerRepo, tempBridge } from "./harness.ts";

test("clones a registered repo at its trunk, then leaves the checkout as it is", async () => {
	const dir = await tempBridge("hydrate");
	const source = greetCapeRepo();
	await registerRepo(dir, "greet-cape", source);
	const bridge = findBridge(dir)!;
	const first = hydrateRepo(bridge, "greet-cape");
	assert.equal(first.dir, join(dir, "workspace", "greet-cape"));
	assert.match(first.said, new RegExp(`^workspace/greet-cape: cloned main at ${git(["rev-parse", "--short", "HEAD"], source)}$`));
	writeFileSync(join(first.dir, "local.txt"), "work in progress\n");
	assert.equal(hydrateRepo(bridge, "greet-cape").said, "workspace/greet-cape: checked out already");
	assert.equal(git(["status", "--porcelain"], first.dir), "?? local.txt");
	assert.throws(() => hydrateRepo(bridge, "unregistered"), /no repo named unregistered/);
});

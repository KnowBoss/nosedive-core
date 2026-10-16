// checkout-path
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "../src/i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13c760de87562b4738946402010b8 as checkoutPath } from "../src/i01a13c760de87562b4738946402010b8.ts";
import { gitRepo, ok, run, tempBridge } from "./harness.ts";

test("puts a repo at <workspace>/<name> in a base, and refuses anywhere else", async () => {
	const base = await tempBridge("checkout-path");
	assert.equal(checkoutPath(findBridge(base)!, "other"), join(base, "workspace", "other"));
	const cape = gitRepo("checkout-path-cape");
	ok(await run(["seed", "--root-kind", "cape"], cape));
	assert.throws(() => checkoutPath(findBridge(cape)!, "other"), /other cannot be checked out here: only a base has a workspace/);
});

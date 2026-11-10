// checkout-path
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13c760de87562b4738946402010b8 as checkoutPath, pathComponent } from "./i01a13c760de87562b4738946402010b8.ts";
import { gitRepo, ok, run, tempBridge } from "../test/harness.ts";

test("puts a repo at <workspace>/<name> in a base, and refuses anywhere else", async () => {
	const base = await tempBridge("checkout-path");
	assert.equal(checkoutPath(findBridge(base)!, "other"), join(base, "workspace", "other"));
	const cape = gitRepo("checkout-path-cape");
	ok(await run(["seed", "--root-kind", "cape"], cape));
	assert.throws(() => checkoutPath(findBridge(cape)!, "other"), /other cannot be checked out here: only a hero repo has a workspace/);
});

test("refuses a name that is no single path component, so no checkout lands outside the workspace", async () => {
	const base = await tempBridge("checkout-path-names");
	for (const bad of ["", ".", "..", "../up", "a/b", "a\\b", "C:x", "a\u0000b"]) {
		assert.throws(() => checkoutPath(findBridge(base)!, bad), /a repo's name, .*, is no single path component/, JSON.stringify(bad));
	}
	for (const good of ["nosedive-core", "a.b", "..x", "x..", "name with space"]) assert.equal(pathComponent(good, "a name"), good);
});

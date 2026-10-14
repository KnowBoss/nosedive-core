// checkout-path
import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "../src/a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a13c760de87562b4738946402010b8 as checkoutPath } from "../src/a01a13c760de87562b4738946402010b8.ts";
import { a01a138b2b8f0793495b66bc7935c93be as hydrateRepo } from "../src/a01a138b2b8f0793495b66bc7935c93be.ts";
import { registerRepo, tempBridge } from "./harness.ts";

test("puts a repo at <workspace>/<name>, and the repo nosedive runs in at __self", async () => {
	const dir = await tempBridge("checkout-path");
	await registerRepo(dir, "other", "../other");
	const self = findBridge(dir)!.self!;
	writeFileSync(join(dir, "kb", `${self}.md`), `---\nkind: repo\nid: ${self}\nname: home\nmeta:\n  remotes:\n    local: ${JSON.stringify(dir)}\n---\n`);
	const bridge = findBridge(dir)!;
	assert.equal(checkoutPath(bridge, "other"), join(dir, "workspace", "other"));
	assert.equal(checkoutPath(bridge, "home"), join(dir, "workspace", "__self"));
	assert.equal(hydrateRepo(bridge, "home").said.split(":")[0], "workspace/__self");
	assert.ok(existsSync(join(dir, "workspace", "__self", ".nosedive", "config.yaml")), "the clone is the repo itself");
});

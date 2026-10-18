// find-root
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a13a6aba3a763595bd67a4ee4d47bf as findRoot } from "./i01a13a6aba3a763595bd67a4ee4d47bf.ts";
import { checkedOut, gitRepo, tempBridge } from "../test/harness.ts";

const ROOT = "01a1335b-f253-7b80-ab64-d2f9a03c9634";

test("reads the root the config names, as root or as backlog, and its kind", async () => {
	for (const key of ["root", "backlog"]) {
		const dir = gitRepo(`find-root-${key}`);
		mkdirSync(join(dir, ".nosedive"));
		mkdirSync(join(dir, "kb"));
		writeFileSync(join(dir, ".nosedive", "config.yaml"), `${key}: ${ROOT}\n`);
		writeFileSync(join(dir, "kb", `${ROOT}.md`), `---\nkind: cape\nid: ${ROOT}\n---\n`);
		assert.equal(findRoot(dir)?.kind, "cape");
	}
});

test("finds nothing for a repo that is no bridge, even inside a bridge's workspace", async () => {
	const bridge = await tempBridge("find-root-none");
	assert.equal(findRoot(checkedOut(bridge, "plain")), undefined);
	assert.equal(findRoot(bridge)?.kind, "base", "a base's root is a base");
});

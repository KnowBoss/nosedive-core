// read-repo-config
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { checkedOut, gitRepo, ok, run, tempBridge } from "../test/harness.ts";

test("reads only the directory's own config, so a checkout in a workspace reads as itself", async () => {
	const base = await tempBridge("read-repo-config");
	const inner = checkedOut(base, "inner");
	assert.equal(readRepoConfig(inner), undefined, "no config of its own");
	assert.equal(readRepoConfig(base)?.workspace, join(base, "workspace"));
	const cape = gitRepo("read-repo-config-cape");
	ok(await run(["seed", "--root-kind", "cape"], cape));
	assert.equal(readRepoConfig(cape)?.workspace, undefined, "only a base has a workspace");
	assert.match(readRepoConfig(cape)?.root ?? "", /^[0-9a-f-]{36}$/);
});

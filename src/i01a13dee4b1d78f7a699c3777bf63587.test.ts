// read-repo-config
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
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
	assert.equal(readRepoConfig(cape)?.workspace, undefined, "only a ship has a workspace");
	assert.match(readRepoConfig(cape)?.root ?? "", /^[0-9a-f-]{36}$/);
});

test("reads a legacy base with a workspace as a ship, and refuses two roots", async () => {
	const legacy = gitRepo("read-repo-config-legacy");
	ok(await run(["seed", "--root-kind", "base"], legacy));
	const config = join(legacy, ".nosedive", "config.yaml");
	const root = readRepoConfig(legacy)!.root!;
	assert.equal(readRepoConfig(legacy)?.workspace, undefined, "a base is data only");
	const doc = join(legacy, "kb", `${root}.md`);
	writeFileSync(doc, readFileSync(doc, "utf8").replace("\n---\n", "\nmeta:\n  workspace: ./repos\n---\n"));
	writeFileSync(config, readFileSync(config, "utf8").replace("base: ", "backlog: ") + `root: ${root}\n`);
	assert.equal(readRepoConfig(legacy)?.workspace, join(legacy, "repos"), "the same root under two legacy keys is one root");
	writeFileSync(config, `${readFileSync(config, "utf8")}ship: 01a15bad-d497-76c0-9308-6c2a30a7ad6f\n`);
	assert.throws(() => readRepoConfig(legacy), /names more than one root/);
});

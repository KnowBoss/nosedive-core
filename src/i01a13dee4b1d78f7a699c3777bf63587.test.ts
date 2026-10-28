// read-repo-config
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
	assert.equal(readRepoConfig(cape)?.workspace, undefined, "only a hero repo has a workspace");
	assert.match(readRepoConfig(cape)?.root ?? "", /^[0-9a-f-]{36}$/);
});

test("reads a repo's id, roots, workspace and where it keeps kinds and repos from its config", async () => {
	const dir = gitRepo("read-repo-config-roots");
	const [id, first, second] = ["01a1335b-f253-7b80-ab64-d2f9a03c9630", "01a1335b-f253-7b80-ab64-d2f9a03c9631", "01a1335b-f253-7b80-ab64-d2f9a03c9632"];
	mkdirSync(join(dir, ".nosedive"));
	writeFileSync(join(dir, ".nosedive", "config.yaml"), `id: ${id}\nworkspace: ./repos\nroots:\n  - kb/${first}.md\n  - clients/acme/${second}.md\n`);
	const bridge = readRepoConfig(dir)!;
	assert.equal(bridge.id, id);
	assert.deepEqual(bridge.roots, [
		{ id: first, dir: join(dir, "kb"), path: join(dir, "kb", `${first}.md`) },
		{ id: second, dir: join(dir, "clients", "acme"), path: join(dir, "clients", "acme", `${second}.md`) },
	]);
	assert.equal(bridge.kbDir, join(dir, "kb"), "the first root's directory");
	assert.equal(bridge.root, first);
	assert.equal(bridge.workspace, join(dir, "repos"));
	assert.equal(bridge.kindsDir, join(dir, ".nosedive", "kinds"));
	assert.equal(bridge.reposDir, join(dir, ".nosedive", "repos"));
	writeFileSync(join(dir, ".nosedive", "config.yaml"), `roots:\n  - kb/${first}.md\n`);
	assert.equal(readRepoConfig(dir)!.id, first, "without an id, the first root's stands in");
	assert.equal(readRepoConfig(dir)!.workspace, undefined, "only a workspace in config makes one");
	writeFileSync(join(dir, ".nosedive", "config.yaml"), "roots:\n  - kb/notes.md\n");
	assert.throws(() => readRepoConfig(dir), /each of `roots` is a path to a doc named by its quid, not "kb\/notes\.md"/);
});

test("reads a config without roots as having none, its kb kb/ and its workspace its own", async () => {
	const dir = gitRepo("read-repo-config-rootless");
	mkdirSync(join(dir, ".nosedive"));
	writeFileSync(join(dir, ".nosedive", "config.yaml"), "kb: ./notes\nbacklog: 01a15bad-d497-76c0-9308-6c2a30a7ad6f\nworkspace: ./repos\n");
	const config = readRepoConfig(dir)!;
	assert.deepEqual(config.roots, []);
	assert.equal(config.kbDir, join(dir, "kb"));
	assert.equal(config.workspace, join(dir, "repos"));
});

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
	assert.equal(readRepoConfig(cape)?.workspace, undefined, "only a ship has a workspace");
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

test("reads an older config's root from its kb, a base with a workspace as a ship, and refuses two roots", async () => {
	const legacy = gitRepo("read-repo-config-legacy");
	const root = ok(await run(["mint"], legacy));
	mkdirSync(join(legacy, "kb"));
	mkdirSync(join(legacy, ".nosedive"));
	const doc = join(legacy, "kb", `${root}.md`);
	writeFileSync(doc, `---\nkind: base\nid: ${root}\nname: old\n---\n`);
	const config = join(legacy, ".nosedive", "config.yaml");
	writeFileSync(config, `kb: ./kb\nbase: ${root}\n`);
	assert.equal(readRepoConfig(legacy)?.workspace, undefined, "a base is data only");
	assert.deepEqual(readRepoConfig(legacy)?.roots, [{ id: root, dir: join(legacy, "kb"), path: join(legacy, "kb", `${root}.md`) }], "its root is its one root");
	writeFileSync(doc, readFileSync(doc, "utf8").replace("\n---\n", "\nmeta:\n  workspace: ./repos\n---\n"));
	writeFileSync(config, readFileSync(config, "utf8").replace("base: ", "backlog: ") + `root: ${root}\n`);
	assert.equal(readRepoConfig(legacy)?.workspace, join(legacy, "repos"), "the same root under two legacy keys is one root");
	writeFileSync(config, `${readFileSync(config, "utf8")}ship: 01a15bad-d497-76c0-9308-6c2a30a7ad6f\n`);
	assert.throws(() => readRepoConfig(legacy), /names more than one root/);
});

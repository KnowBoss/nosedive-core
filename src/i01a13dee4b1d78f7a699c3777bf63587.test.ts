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

test("reads a ship's decks and workspace from its kind file, and refuses two kind files", async () => {
	const ship = gitRepo("read-repo-config-ship");
	ok(await run(["seed", "--no-capes"], ship));
	const bridge = readRepoConfig(ship)!;
	assert.equal(bridge.rootPath, join(ship, ".nosedive", "ship.md"));
	assert.equal(bridge.root, /^id: (\S+)$/m.exec(readFileSync(bridge.rootPath, "utf8"))![1]);
	assert.deepEqual(bridge.decks.map((deck) => deck.dir), [join(ship, "kb")]);
	assert.equal(bridge.kbDir, join(ship, "kb"), "the first deck");
	assert.equal(bridge.kindsDir, join(ship, ".nosedive", "kinds"));
	assert.equal(bridge.reposDir, join(ship, ".nosedive", "repos"));
	writeFileSync(join(ship, ".nosedive", "base.md"), readFileSync(bridge.rootPath, "utf8"));
	assert.throws(() => readRepoConfig(ship), /holds ship\.md and base\.md: a repo is one of ship, cape or base/);
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
	assert.deepEqual(readRepoConfig(legacy)?.decks, [{ dir: join(legacy, "kb"), root }], "its kb is its one deck");
	writeFileSync(doc, readFileSync(doc, "utf8").replace("\n---\n", "\nmeta:\n  workspace: ./repos\n---\n"));
	writeFileSync(config, readFileSync(config, "utf8").replace("base: ", "backlog: ") + `root: ${root}\n`);
	assert.equal(readRepoConfig(legacy)?.workspace, join(legacy, "repos"), "the same root under two legacy keys is one root");
	writeFileSync(config, `${readFileSync(config, "utf8")}ship: 01a15bad-d497-76c0-9308-6c2a30a7ad6f\n`);
	assert.throws(() => readRepoConfig(legacy), /names more than one root/);
});

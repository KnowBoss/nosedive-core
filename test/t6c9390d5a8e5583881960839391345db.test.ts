// crud <kind> <gist>... [--name <name>] [--meta <source>]
import assert from "node:assert/strict";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "../src/i01a1335480147d0686528aee80f8ee34.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "../src/i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "../src/i01a1337d2c14754f9772dc22c1f2edfc.ts";
import { checkedOut, git, gitRepo, ok, run, tempBridge, tempDir } from "./harness.ts";

test("mints a doc named from its gist, and commits it", async () => {
	const bridge = await tempBridge("crud-mint");
	const path = ok(await run(["crud", "memo", "Hello,", "capes", "world!"], bridge));
	const id = path.replace(/^kb\/|\.md$/g, "");
	assert.equal(
		readFileSync(join(bridge, path), "utf8"),
		`---\nkind: memo\nid: ${id}\nname: hello-capes-world-${id.slice(-6)}\ngist: "Hello, capes world!"\n---\n\n# Hello, capes world!\n`,
	);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), `crud(${id}): created memo hello-capes-world-${id.slice(-6)}`);
	assert.equal(git(["status", "--porcelain"], bridge), "");
});

test("--name names the doc, in any position", async () => {
	const bridge = await tempBridge("crud-mint-name");
	const path = ok(await run(["crud", "--name", "my-note", "memo", "a", "gist"], bridge));
	assert.match(readFileSync(join(bridge, path), "utf8"), /\nname: my-note\n/);
});

test("refuses outside a bridge, and a kind that is not a slug", async () => {
	const bridge = await tempBridge("crud-mint-refuse");
	const badKind = await run(["crud", "Memo", "a", "gist"], bridge);
	assert.equal(badKind.code, 1);
	assert.match(badKind.err, /kind must be lowercase/);
	const outside = await run(["crud", "memo", "a", "gist"], join(bridge, ".."));
	assert.equal(outside.code, 1);
	assert.match(outside.err, /not in a bridge: run `nosedive seed` first/);
});

test("<repo>:<kind> mints into that repo's checkout in the workspace, and commits there", async () => {
	const bridge = await tempBridge("crud-mint-repo");
	const repo = checkedOut(bridge, "other");
	const path = ok(await run(["crud", "other:memo", "over", "there"], bridge));
	assert.match(path, /^workspace\/other\/kb\/[0-9a-f-]{36}\.md$/);
	assert.match(git(["log", "-1", "--format=%s"], repo), /^crud\(\S+\): created memo over-there-/);
	assert.equal(git(["status", "--porcelain"], bridge), "", "the workspace is ignored");
	const missing = await run(["crud", "elsewhere:memo", "x"], bridge);
	assert.equal(missing.code, 1);
	assert.match(missing.err, /elsewhere is not checked out at workspace\/elsewhere/);
});

test("checks the kind: warns when nothing declares it, refuses a schema an empty meta breaks", async () => {
	const bridge = await tempBridge("crud-mint-kinds");
	const undeclared = await run(["crud", "feat", "a", "feat"], bridge);
	assert.equal(undeclared.code, 0);
	assert.match(undeclared.err, /no kind feat is declared here; its meta is not checked/);
	writeFileSync(
		join(bridge, "kb", "task-kind.md"),
		"---\nkind: kind\nid: k\nname: task\nmeta:\n  schema:\n    type: object\n    additionalProperties: false\n    required: [owner]\n    properties:\n      owner: {type: string}\n---\n",
	);
	const refused = await run(["crud", "task", "a", "task"], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /meta does not fit kind task:\n {2}meta must have required property 'owner'/);
});

test("--meta mints the doc with its meta, checked against its kind", async () => {
	const bridge = await tempBridge("crud-mint-meta");
	const path = ok(await run(["crud", "goal", "the", "hello", "cape", "--meta", "-"], bridge, "size: 2\n"));
	assert.match(readFileSync(join(bridge, path), "utf8"), /\ngist: "the hello cape"\nmeta:\n {2}size: 2\n---\n/);
	const refused = await run(["crud", "repo", "local", "--name", "local", "--meta", "-"], bridge, "remotes:\n  local: ../hello\n");
	assert.equal(refused.code, 1);
	assert.match(refused.err, /meta does not fit kind repo:\n {2}\/remotes must NOT be valid/);
});

test("a repo the bridge mints gets a home copy, mirroring its other remote, or empty", async () => {
	const bridge = await tempBridge("crud-mint-repo-home");
	const homes = tempDir("crud-mint-homes");
	appendFileSync(join(bridge, ".nosedive", "config.yaml"), `home: ${JSON.stringify(homes)}\n`);
	const cloud = gitRepo("crud-mint-cloud");
	git(["commit", "-q", "--allow-empty", "-m", "first"], cloud);

	const out = ok(await run(["crud", "repo", "hello", "--name", "hello", "--meta", "-"], bridge, `remotes:\n  cloud: ${JSON.stringify(cloud)}\n`));
	const home = join(homes, `${namespacedUuid("hello", findBridge(bridge)!.root!)}.git`);
	assert.equal(out.split("\n")[1], `home copy ${home.replace(/\\/g, "/")}`);
	assert.equal(git(["log", "-1", "--format=%s"], home), "first");
	assert.equal(git(["rev-parse", "--is-bare-repository"], home), "true");

	ok(await run(["crud", "repo", "fresh", "--name", "fresh"], bridge));
	const fresh = join(homes, `${namespacedUuid("fresh", findBridge(bridge)!.root!)}.git`);
	assert.equal(git(["rev-parse", "--is-bare-repository"], fresh), "true");
	assert.equal(findRepoDoc(findBridge(bridge)!, "fresh").remote, fresh, "a repo with no other remote clones from home");
});

test("a repo the bridge mints needs a name and a reachable home, and nothing is minted without them", async () => {
	const bridge = await tempBridge("crud-mint-repo-refused");
	const head = git(["rev-parse", "HEAD"], bridge);
	assert.match((await run(["crud", "repo", "unnamed"], bridge)).err, /a repo needs --name/);
	assert.match((await run(["crud", "repo", "x", "--name", "x"], bridge)).err, /a repo needs a home: set `home` in \.nosedive\/config\.yaml/);
	appendFileSync(join(bridge, ".nosedive", "config.yaml"), `home: ${JSON.stringify(join(tempDir("crud-mint-gone"), "missing"))}\n`);
	assert.match((await run(["crud", "repo", "x", "--name", "x"], bridge)).err, /cannot reach the home .+missing, so no repo was created/);
	assert.equal(git(["rev-parse", "HEAD"], bridge), head);
	assert.equal(git(["status", "--porcelain", "kb"], bridge), "");

	const twice = await tempBridge("crud-mint-repo-twice");
	appendFileSync(join(twice, ".nosedive", "config.yaml"), `home: ${JSON.stringify(tempDir("crud-mint-twice"))}\n`);
	ok(await run(["crud", "repo", "once", "--name", "once"], twice));
	assert.match((await run(["crud", "repo", "again", "--name", "once"], twice)).err, /\.git already exists/);
});

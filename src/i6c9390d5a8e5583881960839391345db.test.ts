// crud <kind> <gist>... [--name <name>] [--meta <source>] [--into <path>]
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./i01a1337d2c14754f9772dc22c1f2edfc.ts";
import { checkedOut, git, gitRepo, ok, run, tempBridge, tempDir, kbOf } from "../test/harness.ts";

test("mints a doc named from its gist, and commits it", async () => {
	const bridge = await tempBridge("crud-mint");
	const path = ok(await run(["crud", "memo", "Hello,", "capes", "world!"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
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
		join(kbOf(bridge), "task-kind.md"),
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
	assert.match(refused.err, /meta does not fit kind repo:\n {2}\/remotes must have required property 'origin'/);
});

test("registers a repo whose origin git reaches, making nothing else", async () => {
	const bridge = await tempBridge("crud-mint-repo");
	const source = gitRepo("crud-mint-repo-source");
	const out = ok(await run(["crud", "repo", "hello", "--name", "hello", "--meta", "-"], bridge, `remotes:\n  origin: ${JSON.stringify(source)}\n  backup: ssh://elsewhere/hello.git\n`));
	assert.match(out, /^\.nosedive\/repos\/[0-9a-f-]{36}\.md$/);
	assert.equal(findRepoDoc(findBridge(bridge)!, "hello").remote, source);
	assert.equal(git(["status", "--porcelain"], bridge), "");
});

test("refuses a repo with no name, a name taken, or an origin git cannot reach, writing nothing", async () => {
	const bridge = await tempBridge("crud-mint-repo-refused");
	const source = gitRepo("crud-mint-repo-refused-source");
	const meta = `remotes:\n  origin: ${JSON.stringify(source)}\n`;
	ok(await run(["crud", "repo", "once", "--name", "once", "--meta", "-"], bridge, meta));
	const head = git(["rev-parse", "HEAD"], bridge);
	assert.match((await run(["crud", "repo", "unnamed", "--meta", "-"], bridge, meta)).err, /a repo needs --name/);
	assert.match((await run(["crud", "repo", "again", "--name", "once", "--meta", "-"], bridge, meta)).err, /a repo named once is registered already/);
	const gone = join(tempDir("crud-mint-repo-gone"), "missing.git");
	assert.match((await run(["crud", "repo", "x", "--name", "x", "--meta", "-"], bridge, `remotes:\n  origin: ${JSON.stringify(gone)}\n`)).err, /cannot reach .+missing\.git, so no repo was registered/);
	assert.equal(git(["rev-parse", "HEAD"], bridge), head);
	assert.equal(git(["status", "--porcelain"], bridge), "");
});

test("keeps kinds and repos in .nosedive/, and mints into the root --into names, else the only root", async () => {
	const bridge = await tempBridge("crud-mint-into");
	const kind = ok(await run(["crud", "kind", "An", "idea", "--name", "idea", "--meta", "-"], bridge, "schema:\n  type: object\n  additionalProperties: false\n"));
	assert.match(kind, /^\.nosedive\/kinds\/[0-9a-f-]{36}\.md$/, "a kind is shared by every root");
	const idea = await run(["crud", "idea", "fly"], bridge);
	assert.equal(idea.err, "", "a kind in .nosedive/ is declared");
	assert.match(idea.out, /^kb\/[0-9a-f-]{36}\.md$/);
	const repo = ok(await run(["crud", "repo", "A", "repo", "--name", "far", "--meta", "-"], bridge, `remotes:\n  origin: ${JSON.stringify(gitRepo("crud-mint-into-far"))}\n`));
	assert.match(repo, /^\.nosedive\/repos\/[0-9a-f-]{36}\.md$/);

	const acme = ok(await run(["mint"], bridge));
	mkdirSync(join(bridge, "clients", "acme"), { recursive: true });
	writeFileSync(join(bridge, "clients", "acme", `${acme}.md`), `---\nkind: root\nid: ${acme}\nname: acme\n---\n`);
	const config = join(bridge, ".nosedive", "config.yaml");
	writeFileSync(config, `${readFileSync(config, "utf8")}  - clients/acme/${acme}.md\n`);
	git(["add", "-A"], bridge);
	git(["commit", "-qm", "a second root"], bridge);
	const many = await run(["crud", "memo", "where"], bridge);
	assert.equal(many.code, 1);
	assert.match(many.err, /this repo has 2 roots: name one with --into <path>, one of kb\/[0-9a-f-]{36}\.md, clients\/acme\/[0-9a-f-]{36}\.md/);
	const there = ok(await run(["crud", "memo", "here", "--into", "clients/acme"], bridge));
	assert.match(there, /^clients\/acme\/[0-9a-f-]{36}\.md$/, "a root is named by its directory");
	assert.match(ok(await run(["crud", "memo", "also", "--into", `clients/acme/${acme}.md`], bridge)), /^clients\/acme\//, "or by its path");
	ok(await run(["crud", there.replace(/^.*\/|\.md$/g, ""), "--gist", "found"], bridge));
	assert.match((await run(["crud", "memo", "nowhere", "--into", "./none"], bridge)).err, /\.\/none is no root of this repo; its roots: kb\/[0-9a-f-]{36}\.md, clients\/acme\//);
});

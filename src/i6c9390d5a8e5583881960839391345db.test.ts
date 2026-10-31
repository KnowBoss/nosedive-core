// crud <kind> <gist>... [--name <name>] [--meta <source>]
import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./i01a1337d2c14754f9772dc22c1f2edfc.ts";
import { i01a147171f057d019118aaa1f269f5fd as findKind, digestOf, versionOf } from "./i01a147171f057d019118aaa1f269f5fd.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { CORE, checkedOut, declareKinds, git, gitRepo, kbOf, ok, run, tempBridge, tempDir } from "../test/harness.ts";

const core: Cape = await sourceCape();

test("mints a doc named from its gist, and commits it", async () => {
	const bridge = await tempBridge("crud-mint");
	const path = ok(await run(["crud", "core:memo", "Hello,", "capes", "world!"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	// Core's kind is not the hero's own, so the doc names core in a canonical scope, with the version of core's memo.
	const kind = findKind("core:memo", findBridge(bridge)!, [core])!;
	const memo = versionOf(kind);
	assert.equal(
		readFileSync(join(bridge, path), "utf8"),
		`---\nkind: memo\nid: ${id}\nname: hello-capes-world-${id.slice(-6)}\ngist: "Hello, capes world!"\nscopes:\n  - ${CORE}:\n      canonical: true\n      version: ${memo}\n      schema: ${digestOf(kind)}\n---\n\n# Hello, capes world!\n`,
	);
	assert.match(memo!, /^[0-9a-f]{40}$/);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), "crud: core:memo");
	assert.equal(git(["status", "--porcelain"], bridge), "");
});

test("a kind of the repo's own is written bare, with no scope; a bare kind nothing declares is refused, naming the spelling that is declared", async () => {
	const bridge = await tempBridge("crud-mint-own");
	ok(await run(["crud", "core:kind", "An", "idea", "--name", "idea", "--meta", "-"], bridge, "schema:\n  type: object\n  additionalProperties: true\n"));
	const path = ok(await run(["crud", "idea", "mine"], bridge));
	assert.doesNotMatch(readFileSync(join(bridge, path), "utf8"), /scopes/);
	const memo = await run(["crud", "memo", "bare"], bridge);
	assert.equal(memo.code, 1);
	assert.match(memo.err, /no kind memo is declared here, and a bare kind is the repo's own: the hero can declare one of that name; memo is declared as core:memo, nosedive-core:memo, 01a1336b-c0b8-7cde-b7c6-285196062297:memo/);
	assert.equal(memo.out, "", "nothing was written");
	const galleon = await run(["crud", "galleon", "bare"], bridge);
	assert.equal(galleon.code, 1);
	assert.match(galleon.err, /no kind galleon is declared here, and a bare kind is the repo's own: the hero can declare one of that name$/, "no spelling to name");
});

test("a kind that is not the holding repo's own is named in a canonical scope, versioned, and refused while its schema is unpublished", async () => {
	const bridge = await tempBridge("crud-mint-foreign");
	ok(await run(["crud", "core:kind", "An", "idea", "--name", "idea", "--meta", "-"], bridge, "schema:\n  type: object\n  additionalProperties: true\n"));
	const loose = checkedOut(bridge, "loose");
	const refused = await run(["--at", "workspace/loose", "crud", "idea", "fly"], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /the schema of kind idea is not on its owner's origin trunk or a feat's work branch: land or push it first/);
	assert.equal(readdirSync(loose).filter((file) => file.endsWith(".md")).length, 0);

	const origin = tempDir("crud-mint-foreign-origin");
	git(["init", "-q", "--bare", "-b", "main"], origin);
	git(["remote", "add", "origin", origin], bridge);
	git(["push", "-q", "origin", "main"], bridge);
	const path = ok(await run(["--at", "workspace/loose", "crud", "idea", "fly"], bridge));
	const hero = findBridge(bridge)!;
	const version = versionOf(findKind("idea", hero, [core])!);
	assert.ok(readFileSync(join(bridge, path), "utf8").includes(`\nscopes:\n  - ${hero.id}:\n      canonical: true\n      version: ${version}\n`));
});

test("--name names the doc, in any position", async () => {
	const bridge = await tempBridge("crud-mint-name");
	const path = ok(await run(["crud", "--name", "my-note", "core:memo", "a", "gist"], bridge));
	assert.match(readFileSync(join(bridge, path), "utf8"), /\nname: my-note\n/);
});

test("refuses outside a bridge, and a kind that is not a slug", async () => {
	const bridge = await tempBridge("crud-mint-refuse");
	const badKind = await run(["crud", "Memo", "a", "gist"], bridge);
	assert.equal(badKind.code, 1);
	assert.match(badKind.err, /kind must be lowercase/);
	const outside = await run(["crud", "core:memo", "a", "gist"], join(bridge, ".."));
	assert.equal(outside.code, 1);
	assert.match(outside.err, /not in a bridge: run `nosedive seed` first/);
});

test("--at writes into a workspace checkout, at any directory of it, and commits there; <cape>:<kind> names whose kind", async () => {
	const bridge = await tempBridge("crud-mint-repo");
	const repo = checkedOut(bridge, "other");
	const path = ok(await run(["--at", "workspace/other", "crud", "core:memo", "over", "there"], bridge));
	assert.match(path, /^workspace\/other\/[0-9a-f-]{36}\.md$/);
	assert.equal(git(["log", "-1", "--format=%s"], repo), "crud: core:memo");
	assert.equal(git(["status", "--porcelain"], bridge), "", "the workspace is ignored");
	const cores = ok(await run(["--at", "workspace/other/kb", "crud", "nosedive-core:memo", "core's"], bridge));
	assert.match(cores, /^workspace\/other\/kb\//);
	assert.match(readFileSync(join(bridge, cores), "utf8"), new RegExp(`^kind: memo\\n[^]*scopes:\\n  - ${CORE}:\\n      canonical: true\\n`, "m"), "the kind's name, and its owner's id in a canonical scope");
	assert.match((await run(["crud", "nope-cape:memo", "x"], bridge)).err, /nope-cape:memo names no kind; memo is reached as core:memo, nosedive-core:memo, 01a1336b-c0b8-7cde-b7c6-285196062297:memo/);
	assert.match((await run(["--at", "workspace/elsewhere", "crud", "core:memo", "x"], bridge)).err, /workspace\/elsewhere is none/);
});

test("refuses a kind doc named kind: only core declares the kind of kinds", async () => {
	const bridge = await tempBridge("crud-mint-kind-kind");
	assert.match((await run(["crud", "core:kind", "Kinds", "--name", "kind"], bridge)).err, /only core declares the kind named kind/);
});

test("checks the kind: refuses when nothing declares it, and a schema an empty meta breaks", async () => {
	const bridge = await tempBridge("crud-mint-kinds");
	const undeclared = await run(["crud", "feat", "a", "feat"], bridge);
	assert.equal(undeclared.code, 1);
	assert.match(undeclared.err, /no kind feat is declared here, and a bare kind is the repo's own/);
	ok(await run(["crud", "core:kind", "a task", "--name", "task", "--meta", "-"], bridge, "schema:\n  type: object\n  additionalProperties: false\n  required: [owner]\n  properties:\n    owner: {type: string}\n"));
	const refused = await run(["crud", "task", "a", "task"], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /meta does not fit kind task:\n {2}meta must have required property 'owner'/);
});

test("--meta mints the doc with its meta, checked against its kind", async () => {
	const bridge = await tempBridge("crud-mint-meta");
	await declareKinds(bridge, "goal");
	const path = ok(await run(["crud", "goal", "the", "hello", "cape", "--meta", "-"], bridge, "size: 2\n"));
	assert.match(readFileSync(join(bridge, path), "utf8"), /\ngist: "the hello cape"\nmeta:\n {2}size: 2\n---\n/);
	const refused = await run(["crud", "core:repo", "local", "--name", "local", "--meta", "-"], bridge, "remotes:\n  local: ../hello\n");
	assert.equal(refused.code, 1);
	assert.match(refused.err, /meta does not fit kind core:repo:\n {2}\/remotes must have required property 'origin'/);
});

test("registers a repo whose origin git reaches, making nothing else", async () => {
	const bridge = await tempBridge("crud-mint-repo");
	const source = gitRepo("crud-mint-repo-source");
	const out = ok(await run(["crud", "core:repo", "hello", "--name", "hello", "--meta", "-"], bridge, `remotes:\n  origin: ${JSON.stringify(source)}\n  backup: ssh://elsewhere/hello.git\n`));
	assert.match(out, /^\.nosedive\/repos\/[0-9a-f-]{36}\.md$/);
	assert.equal(findRepoDoc(findBridge(bridge)!, "hello").remote, source);
	assert.equal(git(["status", "--porcelain"], bridge), "");
});

test("refuses a repo with no name, a name taken, or an origin git cannot reach, writing nothing", async () => {
	const bridge = await tempBridge("crud-mint-repo-refused");
	const source = gitRepo("crud-mint-repo-refused-source");
	const meta = `remotes:\n  origin: ${JSON.stringify(source)}\n`;
	ok(await run(["crud", "core:repo", "once", "--name", "once", "--meta", "-"], bridge, meta));
	const head = git(["rev-parse", "HEAD"], bridge);
	assert.match((await run(["crud", "core:repo", "unnamed", "--meta", "-"], bridge, meta)).err, /a repo needs --name/);
	assert.match((await run(["crud", "core:repo", "again", "--name", "once", "--meta", "-"], bridge, meta)).err, /a repo named once is registered already/);
	const gone = join(tempDir("crud-mint-repo-gone"), "missing.git");
	assert.match((await run(["crud", "core:repo", "x", "--name", "x", "--meta", "-"], bridge, `remotes:\n  origin: ${JSON.stringify(gone)}\n`)).err, /cannot reach .+missing\.git, so no repo was registered/);
	assert.equal(git(["rev-parse", "HEAD"], bridge), head);
	assert.equal(git(["status", "--porcelain"], bridge), "");
});

test("keeps core's kinds and repos in .nosedive/, whatever the target, and mints anything else into it", async () => {
	const bridge = await tempBridge("crud-mint-into");
	const kind = ok(await run(["crud", "core:kind", "An", "idea", "--name", "idea", "--meta", "-"], bridge, "schema:\n  type: object\n  additionalProperties: false\n"));
	assert.match(kind, /^\.nosedive\/kinds\/[0-9a-f-]{36}\.md$/, "a kind is shared by every root");
	const idea = await run(["crud", "idea", "fly"], bridge);
	assert.equal(idea.err, "", "a kind in .nosedive/ is declared");
	assert.equal(dirname(join(bridge, idea.out)), kbOf(bridge));
	const repo = ok(await run(["crud", "core:repo", "A", "repo", "--name", "far", "--meta", "-"], bridge, `remotes:\n  origin: ${JSON.stringify(gitRepo("crud-mint-into-far"))}\n`));
	assert.match(repo, /^\.nosedive\/repos\/[0-9a-f-]{36}\.md$/);

	const acme = ok(await run(["mint"], bridge));
	mkdirSync(join(bridge, "clients", "acme"), { recursive: true });
	writeFileSync(join(bridge, "clients", "acme", `${acme}.md`), `---\nkind: base\nid: ${acme}\nname: acme\n---\n`);
	const config = join(bridge, ".nosedive", "config.yaml");
	writeFileSync(config, `${readFileSync(config, "utf8")}  - clients/acme/${acme}.md\n`);
	git(["add", "-A"], bridge);
	git(["commit", "-qm", "a second root"], bridge);
	assert.equal(dirname(join(bridge, ok(await run(["crud", "core:memo", "where"], bridge)))), kbOf(bridge), "the primary root by default");
	const there = ok(await run(["--at", "acme", "crud", "core:memo", "here"], bridge));
	assert.match(there, /^clients\/acme\/[0-9a-f-]{36}\.md$/, "a root is named by its name");
	ok(await run(["crud", there.replace(/^.*\/|\.md$/g, ""), "--gist", "found"], bridge));
	assert.match((await run(["--at", "acme", "crud", "core:repo", "B", "--name", "b"], bridge)).err, /core's repos live in \.nosedive\/repos, where the hero reads them, whatever base is selected: drop --at/);
});

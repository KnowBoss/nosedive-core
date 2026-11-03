// configured-capes
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { featTree } from "./i01a1901e263b7209a4b5f39a71c568b3.ts";
import { i01a13a6aba3a763595bd67a4ee4d47bf as findRoot } from "./i01a13a6aba3a763595bd67a4ee4d47bf.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { git, greetCapeRepo, ok, registerRepo, run, setCapes, tempBridge, tempDir, kbPath } from "../test/harness.ts";

const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");

const core: Cape = await sourceCape();

test("lists each cape the base wears with its repo, and its build once there is one", async () => {
	const bridge = await tempBridge("configured-capes");
	const repo = greetCapeRepo();
	const id = await registerRepo(bridge, "greet-cape", repo);
	await registerRepo(bridge, "unknown-cape");
	setCapes(bridge, ["greet-cape", "unknown-cape@v1"]);
	const before = configuredCapes(findBridge(bridge)!, core);
	assert.deepEqual(
		before.map(({ spec, name, ref, repo, build }) => ({ spec, name, ref, repo: repo?.id, build })),
		[
			{ spec: "greet-cape", name: "greet-cape", ref: "", repo: id, build: undefined },
			{ spec: "unknown-cape@v1", name: "unknown-cape", ref: "v1", repo: undefined, build: undefined },
		],
	);
	setCapes(bridge, ["greet-cape"]);
	ok(await run(["seed"], bridge));
	const [built] = configuredCapes(findBridge(bridge)!, core);
	assert.equal(built!.build!.commit, git(["rev-parse", "HEAD"], repo));
	assert.deepEqual(built!.build!.actions, { greet: "Greets" });
});

test("pass --attach-cape builds a registered cape and links it from the base, --detach-cape detaches it, and drop needs it off", async () => {
	const bridge = await tempBridge("configured-capes-attach");
	const id = await registerRepo(bridge, "greet-cape", greetCapeRepo());
	git(["add", "-A"], bridge);
	git(["commit", "-qm", "register greet-cape"], bridge);
	assert.match(ok(await run(["pass", "--attach-cape", id], bridge)), /attached greet-cape \S+ \([0-9a-f]{7}\)/);
	assert.deepEqual(configuredCapes(findBridge(bridge)!, core).map(({ name, build }) => [name, build?.actions]), [["greet-cape", { greet: "Greets" }]]);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), "pass: attach-cape");
	assert.match((await run(["crud", "--drop", id, "--hard"], bridge)).err, /still linked/);
	assert.match(ok(await run(["pass", "--detach-cape", id], bridge)), /detached greet-cape/);
	assert.deepEqual(configuredCapes(findBridge(bridge)!, core), []);
	assert.match((await run(["pass", "--detach-cape", id], bridge)).err, /the base does not wear greet-cape/);
});

test("pass --attach-cape pins the commit its ref resolves to, builds keep to it as the remote moves, and attaching again bumps it", async () => {
	const bridge = await tempBridge("configured-capes-pin");
	const repo = greetCapeRepo();
	const id = await registerRepo(bridge, "greet-cape", repo);
	git(["add", "-A"], bridge);
	git(["commit", "-qm", "register greet-cape"], bridge);
	const config = readRepoConfig(bridge)!;
	const pinned = () => /commit: ([0-9a-f]{40})/.exec(readFileSync(config.roots.find((root) => root.id === config.root)!.path, "utf8"))?.[1];
	const first = git(["rev-parse", "HEAD"], repo);
	ok(await run(["pass", "--attach-cape", id], bridge));
	assert.equal(pinned(), first);
	git(["commit", "-q", "--allow-empty", "-m", "moved on"], repo);
	ok(await run(["seed"], bridge));
	const [kept] = configuredCapes(findBridge(bridge)!, core);
	assert.equal(kept!.build!.commit, first);
	assert.equal(kept!.spec, "greet-cape");
	assert.match(ok(await run(["pass", "--attach-cape", id], bridge)), /re-attached greet-cape \S+ \([0-9a-f]{7}\)/);
	const second = git(["rev-parse", "HEAD"], repo);
	assert.equal(pinned(), second);
	assert.equal(configuredCapes(findBridge(bridge)!, core)[0]!.build!.commit, second);
	git(["tag", "-a", "v1", "-m", "v1", first], repo);
	assert.match(ok(await run(["pass", "--attach-cape", id, "--ref", "v1"], bridge)), /re-attached greet-cape@v1 /);
	assert.equal(pinned(), first);
	git(["switch", "-qc", "next"], repo);
	git(["commit", "-q", "--allow-empty", "-m", "next"], repo);
	const third = git(["rev-parse", "HEAD"], repo);
	git(["switch", "-q", "-"], repo);
	ok(await run(["pass", "--attach-cape", id, "--ref", "next"], bridge));
	assert.equal(pinned(), third);
	assert.equal(configuredCapes(findBridge(bridge)!, core)[0]!.spec, "greet-cape@next");
});

test("pass --attach-cape takes whatever name the hero gave the repo, and refuses a repo that is no cape", async () => {
	const bridge = await tempBridge("configured-capes-local-name");
	const id = await registerRepo(bridge, "tools-from-acme", greetCapeRepo({ name: "greeter" }));
	const plain = await registerRepo(bridge, "not-a-cape", greetCapeRepo({ plain: true }));
	git(["add", "-A"], bridge);
	git(["commit", "-qm", "register"], bridge);
	assert.match(ok(await run(["pass", "--attach-cape", id], bridge)), /attached tools-from-acme \S+ \([0-9a-f]{7}\)/);
	assert.match((await run(["pass", "--attach-cape", plain], bridge)).err, /not-a-cape is not a cape: it has no root/);
});

test("refuses a .cape link to a doc that is no repo, and reads only the target root's", async () => {
	const bridge = await tempBridge("configured-capes-bad");
	await registerRepo(bridge, "greet-cape", greetCapeRepo());
	setCapes(bridge, ["greet-cape"]);
	const at = findBridge(bridge)!;
	const memo = idOf(ok(await run(["crud", "core:memo", "Not a repo"], bridge)));
	const root = at.roots[0]!.path;
	writeFileSync(root, readFileSync(root, "utf8").replace(/\.nosedive\/repos\/[0-9a-f-]{36}\.md:\n {6}rel: \.cape/, `${kbPath(bridge, memo)}:\n      rel: .cape`));
	assert.throws(() => configuredCapes(findBridge(bridge)!, core), new RegExp(`wears ${kbPath(bridge, memo)}, which is no repo doc`));
	assert.deepEqual(configuredCapes({ ...at, activeRoot: undefined }, core), [], "no target, no capes");
});

/** Seeds `capes/<name>` in a hero as a cape holding core's greet fixture, committed; returns its directory and root's quid. */
async function localGreet(hero: string, name: string): Promise<{ dir: string; root: string }> {
	ok(await run(["--at", `tools/${name}`, "seed", "--root-kind", "cape"], hero));
	const dir = join(hero, "tools", name);
	const fixture = greetCapeRepo();
	for (const file of ["kb", "src"]) cpSync(join(fixture, file), join(dir, file), { recursive: true });
	git(["add", "-A"], hero);
	git(["commit", "-qm", "greet in a local cape"], hero);
	return { dir, root: readRepoConfig(dir)!.root! };
}

test("a local cape is attached by its path, built from its working tree, its action runs, and --detach-cape drops it", async () => {
	const hero = await tempBridge("local-cape");
	const { dir, root } = await localGreet(hero, "greet");
	assert.match(ok(await run(["pass", "--attach-cape", "tools/greet"], hero)), /attached greet working tree/);
	assert.equal(git(["log", "-1", "--format=%s"], hero), "pass: attach-cape");
	assert.match(readFileSync(readRepoConfig(hero)!.roots[0]!.path, "utf8"), new RegExp(`tools/greet/kb/${root}\.md:\n {6}rel: \.cape`));
	assert.deepEqual(configuredCapes(findBridge(hero)!, core).map(({ name, repo, build }) => [name, repo?.id, repo?.dir, build?.actions]), [["greet", root, dir, { greet: "Greets" }]]);
	assert.match(ok(await run(["greet", "ann"], hero)), /^hello ann /);
	assert.match(ok(await run(["--help"], hero)), /\ngreet\n {2}greet\s+Greets/, "listed under its short name");
	assert.match(ok(await run(["--help", "--more"], hero)), /\ngreet working tree\n/, "its version, working tree, behind --more");
	assert.match(ok(await run(["pass"], hero)), /--attach-cape <cape>/);
	// Its build follows its files, not the hero's commits.
	const built = configuredCapes(findBridge(hero)!, core)[0]!.build!.id;
	git(["commit", "-q", "--allow-empty", "-m", "unrelated"], hero);
	assert.equal(ok(await run(["seed"], hero)).includes("built cape"), false);
	assert.equal(configuredCapes(findBridge(hero)!, core)[0]!.build!.id, built);
	assert.match(ok(await run(["seed"], hero)), /cape greet is built/);
	assert.match((await run(["pass", "--attach-cape", "tools/greet"], hero)).err, /the base already wears greet/);
	assert.match(ok(await run(["pass", "--detach-cape", "tools/greet"], hero)), /detached greet/);
	assert.deepEqual(configuredCapes(findBridge(hero)!, core), []);
	assert.match((await run(["pass", "--detach-cape", "tools/greet"], hero)).err, /the base does not wear greet/);
});

test("pass --attach-cape refuses a directory that is no local cape, one not listed in the roots, a workspace checkout and a .nosedive clone", async () => {
	const hero = await tempBridge("local-cape-refuses");
	mkdirSync(join(hero, "plain"));
	const nope = /is a directory, but no local cape of the hero/;
	assert.match((await run(["pass", "--attach-cape", "plain"], hero)).err, nope);
	assert.match((await run(["pass", "--attach-cape", tempDir("outside-cape")], hero)).err, nope);
	assert.match((await run(["pass", "--attach-cape", "."], hero)).err, nope);
	// A cape seeded in a directory and left out of the roots is none yet.
	const loose = join(hero, "tools", "loose");
	mkdirSync(loose, { recursive: true });
	ok(await run(["seed", "--root-kind", "cape"], loose));
	assert.match((await run(["pass", "--attach-cape", "tools/loose"], hero)).err, nope);
	// A cape root checked out in the workspace, or cloned under .nosedive, is no local cape.
	const checkout = join(hero, "workspace", "other-cape");
	git(["clone", "-q", greetCapeRepo(), checkout], hero);
	assert.match((await run(["pass", "--attach-cape", checkout], hero)).err, nope);
	const clone = join(hero, ".nosedive", "capes", "src", "clone");
	git(["clone", "-q", greetCapeRepo(), clone], hero);
	assert.match((await run(["pass", "--attach-cape", clone], hero)).err, nope);
	const root = readRepoConfig(checkout)!.root!;
	assert.match((await run(["pass", "--attach-cape", root], hero)).err, /no doc|is no local cape of this hero/);
});

test("a local cape's root is a hero root that root walks leave to the cape: no tree, no feats, never makes the hero a cape", async () => {
	const hero = await tempBridge("local-cape-walks");
	const { dir } = await localGreet(hero, "greet");
	const rootDoc = readRepoConfig(hero)!.roots[0]!.path;
	const before = readFileSync(rootDoc, "utf8");
	ok(await run(["seed", "--no-capes"], hero));
	assert.equal(readFileSync(rootDoc, "utf8"), before, "the hero's tree does not list the cape's docs");
	assert.equal(findRoot(hero, "cape"), undefined, "the hero is no cape for having one's root");
	assert.equal(readRepoConfig(hero)!.roots.length, 2);
	assert.equal(featTree(findBridge(hero)!).size, 0, "no feat is reached through a cape root");
	// crud, scaf and pass --test find the cape's docs because it is a root.
	assert.match(ok(await run(["crud", readRepoConfig(dir)!.root!], hero)), /^---\nkind: cape\n/);
	assert.match(ok(await run(["pass", "--test", "tools/greet"], hero)), /gate cape-tests-pass: passed$/);
});

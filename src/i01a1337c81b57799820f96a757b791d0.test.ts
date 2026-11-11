// build-cape
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { schemaDigest } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
import { i01a1337c81b57799820f96a757b791d0 as buildCape } from "./i01a1337c81b57799820f96a757b791d0.ts";
import { i01a147171f057d019118aaa1f269f5fd as findKind, versionOf } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./i01a1337d2c14754f9772dc22c1f2edfc.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { CANONICAL, GREET, git, greetCapeRepo, lock, ok, registerRepo, run, setCapes, shoutPackage, tempBridge, tempDir, waveCapeRepo } from "../test/harness.ts";
import { i01a133548178739398941123114401ad as usageId } from "./i01a133548178739398941123114401ad.ts";

const core: Cape = await sourceCape();

test("builds a repo cape at its pin, never from a workspace checkout of its repo at another commit or with uncommitted changes (pin-always-wins)", async () => {
	const repo = greetCapeRepo();
	const pin = git(["rev-parse", "HEAD"], repo);
	const { dir } = await build(repo);
	const checkout = workspaceCheckout(dir, repo);
	const bridge = findBridge(dir)!;
	const messages: string[] = [];
	const built = await buildCape(bridge, findRepoDoc(bridge, "greet-cape"), pin, core, [], (message) => messages.push(message));
	assert.equal(built.commit, pin);
	assert.equal(built.source, undefined);
	assert.doesNotMatch(messages.join("\n"), /workspace/);
	const bundle = readFileSync(join(dir, ".nosedive", "capes", `${built.id}.js`), "utf8");
	assert.match(bundle, /hello/);
	assert.doesNotMatch(bundle, /checkout hello|dirty hello/);
	assert.notEqual(git(["rev-parse", "HEAD"], checkout), pin, "the checkout is left where it was");
	assert.match(git(["status", "--porcelain"], checkout), /src\//, "and its changes too");
});

test("a pin bump takes effect though the workspace holds a checkout of the cape's repo (pin-always-wins)", async () => {
	const repo = greetCapeRepo();
	const { dir } = await build(repo);
	workspaceCheckout(dir, repo);
	setCapes(dir, [`greet-cape@${git(["rev-parse", "HEAD"], repo)}`]);
	ok(await run(["seed"], dir));
	assert.match(ok(await run(["greet", "ann"], dir)), /^hello ann /);
	const impl = join(repo, "src", `i${usageId("greet <who>", GREET)}.ts`);
	writeFileSync(impl, readFileSync(impl, "utf8").replace("hello", "bumped hello"));
	git(["commit", "-qam", "bump"], repo);
	setCapes(dir, [`greet-cape@${git(["rev-parse", "HEAD"], repo)}`]);
	assert.match(ok(await run(["seed"], dir)), /built cape greet-cape/);
	assert.match(ok(await run(["greet", "ann"], dir)), /^bumped hello ann /);
});

test("builds a local cape from its directory without changing it, logs it, and rebuilds uncommitted files", async () => {
	const hero = await tempBridge("build-cape-local");
	ok(await run(["--at", "tools/greet", "seed", "--root-kind", "cape"], hero));
	const local = join(hero, "tools", "greet");
	for (const file of ["kb", "src"]) cpSync(join(greetCapeRepo(), file), join(local, file), { recursive: true });
	git(["add", "-A"], hero);
	git(["commit", "-qm", "greet in a local cape"], hero);
	const bridge = findBridge(hero)!;
	const record = { id: readRepoConfig(local)!.root!, name: "greet", remote: "", dir: local };
	const messages: string[] = [];
	const built = () => buildCape(bridge, record, "", core, [], (message) => messages.push(message));
	const before = git(["rev-parse", "HEAD"], hero);
	const first = await built();
	assert.equal(first.source, local);
	assert.equal(first.version, "working tree");
	assert.match(messages[0]!, /using local cape/);
	assert.equal((await built()).fresh, false);
	const impl = join(local, "src", `i${usageId("greet <who>", GREET)}.ts`);
	writeFileSync(impl, readFileSync(impl, "utf8").replace("hello", "local hello"));
	const second = await built();
	assert.notEqual(second.id, first.id);
	assert.match(readFileSync(join(hero, ".nosedive", "capes", `${second.id}.js`), "utf8"), /local hello/);
	mkdirSync(join(local, "assets"));
	writeFileSync(join(local, "assets", "new.txt"), "new local asset");
	const third = await built();
	assert.notEqual(third.id, second.id);
	assert.equal((await built()).fresh, false);
	assert.equal(git(["rev-parse", "HEAD"], hero), before);
	assert.match(git(["status", "--porcelain"], hero), /tools\/greet\/src\//);
});

/** Clones the cape's repo into the hero's workspace, moves it to a commit of its own, and leaves uncommitted changes in it. */
function workspaceCheckout(hero: string, repo: string): string {
	const checkout = join(hero, "workspace", "greet-cape");
	mkdirSync(join(hero, "workspace"), { recursive: true });
	git(["clone", "-q", repo, checkout], hero);
	const impl = join(checkout, "src", `i${usageId("greet <who>", GREET)}.ts`);
	writeFileSync(impl, readFileSync(impl, "utf8").replace("hello", "checkout hello"));
	git(["commit", "-qam", "only in the checkout"], checkout);
	writeFileSync(impl, readFileSync(impl, "utf8").replace("checkout hello", "dirty hello"));
	writeFileSync(join(checkout, "untracked.txt"), "untracked");
	return checkout;
}

async function build(repo: string, ref = "") {
	const dir = await tempBridge("build-cape");
	await registerRepo(dir, "greet-cape", repo);
	const bridge = findBridge(dir)!;
	return { dir, built: () => buildCape(bridge, findRepoDoc(bridge, "greet-cape"), ref, core) };
}

test("takes a build shipped with this core of the pinned commit, with no clone, and builds any other (shipped-cape-builds)", async () => {
	const repo = greetCapeRepo();
	const commit = git(["rev-parse", "HEAD"], repo);
	// A build made the usual way, then shipped beside a core file.
	const { dir, built } = await build(repo, commit);
	const made = await built();
	const shipped = join(tempDir("build-cape-shipped"), "dist");
	mkdirSync(join(shipped, "capes"), { recursive: true });
	writeFileSync(join(shipped, "capes", "manifest.json"), JSON.stringify([{ ...made, fresh: undefined }]));
	writeFileSync(join(shipped, "capes", `${made.id}.js`), readFileSync(join(dir, ".nosedive", "capes", `${made.id}.js`)));
	const shipping: Cape = { ...core, url: pathToFileURL(join(shipped, "core.js")).href };

	// A hero registering the same repo, as the legacy-capes migration does by its fixed id, whose remote is not there, can only take it shipped.
	const hero = await tempBridge("build-cape-shipped-hero");
	await registerRepo(hero, "greet-cape", repo);
	const bridge = findBridge(hero)!;
	const record = { ...findRepoDoc(bridge, "greet-cape"), id: made.repo, remote: join(hero, "no-such-remote") };
	const messages: string[] = [];
	const taken = await buildCape(bridge, record, commit, shipping, [], (message) => messages.push(message));
	assert.equal(taken.id, made.id);
	assert.equal(taken.fresh, true);
	assert.match(messages.join("\n"), /cape greet-cape: using the build shipped with this core/);
	assert.equal(existsSync(join(hero, ".nosedive", "capes", "src")), false, "nothing was cloned");
	assert.ok(existsSync(join(hero, ".nosedive", "capes", `${made.id}.js`)));
	assert.equal(JSON.parse(readFileSync(join(hero, ".nosedive", "capes", "manifest.json"), "utf8"))[0].id, made.id);
	assert.equal((await buildCape(bridge, record, commit, shipping)).fresh, false, "taken once");

	// Another commit, or another core, is no match, so it is cloned and built: here that fails on the missing remote.
	git(["commit", "-q", "--allow-empty", "-m", "moved on"], repo);
	await assert.rejects(buildCape(bridge, record, git(["rev-parse", "HEAD"], repo), shipping), /no-such-remote/);
	await assert.rejects(buildCape(bridge, record, commit, { ...shipping, id: "another-core" }), /no-such-remote/);
});

test("builds a cape whose core imports resolve only against the core it was built for", async () => {
	const repo = greetCapeRepo();
	const { dir, built } = await build(repo);
	const cape = await built();
	assert.equal(cape.fresh, true);
	assert.equal(cape.commit, git(["rev-parse", "HEAD"], repo));
	assert.equal(cape.core, core.id);
	assert.deepEqual(cape.needs, {});
	assert.match(cape.version, /^\d{4}\.\d{1,2}\.\d{1,2}-\d+$/);
	const file = join(dir, ".nosedive", "capes", `${cape.id}.js`);
	assert.ok(existsSync(file));
	assert.doesNotMatch(readFileSync(file, "utf8"), /createHash/, "core's code must not be bundled into the cape");
	assert.deepEqual(JSON.parse(readFileSync(join(dir, ".nosedive", "capes", "manifest.json"), "utf8"))[0].id, cape.id);
	assert.equal((await built()).fresh, false, "a second build finds the first");

	(globalThis as { __nosediveCore?: unknown }).__nosediveCore = { id: "another-core" };
	await assert.rejects(import(`${pathToFileURL(file).href}?other`), /greet-cape was built against other capes than these: run `nosedive seed`/);
});

test("refuses a core import its docs do not link, or that core does not have", async () => {
	await assert.rejects((await build(greetCapeRepo({ link: false }))).built(), /imports namespaced-uuid \(\S+\) without linking it/);
	const missing = "01a1335b-f3bd-7ef4-9eb1-98115e3ba276";
	await assert.rejects((await build(greetCapeRepo({ importing: missing }))).built(), new RegExp(`imports ${missing} from nosedive-core, which core source does not have`));
});

test("builds the capes a cape imports first, and runs across them", async () => {
	const bridge = await tempBridge("build-cape-imports");
	const greet = greetCapeRepo();
	await registerRepo(bridge, "greet-cape", greet);
	await registerRepo(bridge, "wave-cape", waveCapeRepo());
	setCapes(bridge, ["wave-cape"]);
	assert.match(ok(await run(["seed"], bridge)), /^built cape wave-cape \S+ \(\w{7}\): wave$/m);
	assert.match(ok(await run(["wave", "ann"], bridge)), /^hello ann [0-9a-f-]{36}\nand waves$/);

	const before = ok(await run(["seed"], bridge));
	assert.match(before, /cape wave-cape is built/);
	writeFileSync(join(greet, "README.md"), "changed\n");
	git(["add", "README.md"], greet);
	git(["commit", "-qm", "change greet"], greet);
	assert.match(ok(await run(["seed"], bridge)), /built cape wave-cape/, "a new greet means a new wave");
	assert.match(ok(await run(["wave", "bo"], bridge)), /^hello bo /);
});

test("fetches a cape from the origin its repo doc names now, not the one its clone was made with", async () => {
	const first = greetCapeRepo();
	const dir = await tempBridge("build-cape-origin");
	const id = await registerRepo(dir, "greet-cape", first);
	const bridge = findBridge(dir)!;
	await buildCape(bridge, findRepoDoc(bridge, "greet-cape"), "", core);
	const moved = join(dir, "..", `${id}-moved.git`);
	git(["clone", "-q", "--bare", first, moved], dir);
	const only = git(["commit-tree", "-p", "HEAD", "-m", "only on the new origin", "HEAD^{tree}"], first);
	git(["push", "-q", moved, `${only}:refs/heads/main`], first);
	const doc = join(dir, ".nosedive", "repos", `${id}.md`);
	writeFileSync(doc, readFileSync(doc, "utf8").replace(JSON.stringify(first), JSON.stringify(moved)));
	const cape = await buildCape(findBridge(dir)!, findRepoDoc(findBridge(dir)!, "greet-cape"), only, core);
	assert.equal(cape.commit, only);
});

test("refuses a repo whose root is not a cape", async () => {
	await assert.rejects((await build(greetCapeRepo({ plain: true }))).built(), /greet-cape is not a cape: it has no root/);
});

test("refuses a cape whose docs are bare core kinds, saying it predates canonical kinds", async () => {
	const repo = greetCapeRepo();
	for (const file of readdirSync(join(repo, "kb"))) {
		const path = join(repo, "kb", file);
		writeFileSync(path, readFileSync(path, "utf8").replace(CANONICAL, ""));
	}
	git(["commit", "-qam", "before canonical kinds"], repo);
	const commit = git(["rev-parse", "HEAD"], repo).slice(0, 7);
	await assert.rejects(
		(await build(repo)).built(),
		(err: Error) => err.message === `greet-cape at ${commit} predates canonical kinds: its 1 action/function docs and root do not name core; seed it with this core (the canonical-kinds migration) and push`,
	);
});

test("builds a cape whole: the packages its lockfile pins, installed in its clone, and its assets, bundled in", async () => {
	const repo = greetCapeRepo();
	shoutPackage(repo);
	lock(repo);
	mkdirSync(join(repo, "assets"));
	writeFileSync(join(repo, "assets", "page.html"), "<h1>greetings</h1>");
	const impl = join(repo, "src", `i${usageId("greet <who>", GREET)}.ts`);
	writeFileSync(impl, `import shout from "shout";\nimport page from "../assets/page.html";\n${readFileSync(impl, "utf8").replace("ctx.out(`hello ${who}", "ctx.out(`${shout(page)} ${who}")}`);
	// A global ignore may hide lockfiles.
	git(["add", "-A"], repo);
	git(["add", "-f", "package-lock.json"], repo);
	git(["commit", "-qm", "shout, and a page"], repo);
	const { dir, built } = await build(repo);
	const cape = await built();
	const text = readFileSync(join(dir, ".nosedive", "capes", `${cape.id}.js`), "utf8");
	assert.match(text, /<h1>greetings<\/h1>/);
	assert.match(text, /toUpperCase\(\) \+ \(EOL/, "the package is bundled in");
	const clone = join(dir, ".nosedive", "capes", "src", findRepoDoc(findBridge(dir)!, "greet-cape").id);
	assert.equal(existsSync(join(clone, "node_modules", ".nosedive-lockfile")), true);
	assert.equal(git(["status", "--porcelain"], clone), "", "node_modules stays out of the clone's git");
});

test("records its owner, its short name and the kinds it declares with their versions, which a hero that wears it can name", async () => {
	const repo = greetCapeRepo({ name: "greet" });
	const KIND = "01a18e62-0000-7000-8000-0000000000a9";
	mkdirSync(join(repo, ".nosedive", "kinds"), { recursive: true });
	writeFileSync(join(repo, ".nosedive", "kinds", `${KIND}.md`), `---\nkind: kind\nid: ${KIND}\nname: tag\nmeta:\n  schema:\n    type: object\n    additionalProperties: true\n---\n`);
	git(["add", "-A"], repo);
	git(["commit", "-qm", "a kind"], repo);
	const { dir, built } = await build(repo);
	const cape = await built();
	assert.equal(cape.owner, readRepoConfig(repo)!.id);
	assert.equal(cape.shortName, "greet");
	const head = git(["rev-parse", "HEAD"], repo);
	assert.deepEqual({ ...(cape.kinds!.tag as object) }, { schema: { type: "object", additionalProperties: true }, links: [], id: KIND, file: `.nosedive/kinds/${KIND}.md`, version: head, published: true, digest: schemaDigest({ type: "object", additionalProperties: true }) });

	setCapes(dir, ["greet-cape"]);
	const hero = findBridge(dir)!;
	for (const spelling of ["greet:tag", "greet-cape:tag", `${cape.owner}:tag`]) assert.equal(findKind(spelling, hero, [core])?.version, head, spelling);
	assert.equal(versionOf(findKind("greet:tag", hero, [core])!), head);
});

test("records the seeded ids its root's supersedes.cape links name, which a build shipped with no source carries", async () => {
	const superseded = "01a1c8aa-0000-7000-8000-00000000cafe";
	const repo = greetCapeRepo({ supersedes: [superseded] });
	const commit = git(["rev-parse", "HEAD"], repo);
	const { dir, built } = await build(repo, commit);
	const made = await built();
	assert.deepEqual(made.supersedes, [superseded]);
	assert.deepEqual(JSON.parse(readFileSync(join(dir, ".nosedive", "capes", "manifest.json"), "utf8"))[0].supersedes, [superseded]);

	const shipped = join(tempDir("build-cape-supersedes"), "dist");
	mkdirSync(join(shipped, "capes"), { recursive: true });
	writeFileSync(join(shipped, "capes", "manifest.json"), JSON.stringify([{ ...made, fresh: undefined }]));
	writeFileSync(join(shipped, "capes", `${made.id}.js`), readFileSync(join(dir, ".nosedive", "capes", `${made.id}.js`)));
	const hero = await tempBridge("build-cape-supersedes-hero");
	await registerRepo(hero, "greet-cape", repo);
	const bridge = findBridge(hero)!;
	const record = { ...findRepoDoc(bridge, "greet-cape"), id: made.repo, remote: join(hero, "no-such-remote") };
	const taken = await buildCape(bridge, record, commit, { ...core, url: pathToFileURL(join(shipped, "core.js")).href });
	assert.deepEqual(taken.supersedes, [superseded], "taken with no clone and no source");
});

test("refuses a supersedes.cape link keyed by anything but a seeded id", async () => {
	const { built } = await build(greetCapeRepo({ supersedes: [".nosedive/repos/some-repo.md"] }));
	await assert.rejects(built(), /supersedes \.nosedive\/repos\/some-repo\.md, which is no cape's seeded id: key it by that id/);
});

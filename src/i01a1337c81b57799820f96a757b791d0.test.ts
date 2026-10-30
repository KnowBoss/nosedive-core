// build-cape
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
import { GREET, git, greetCapeRepo, lock, ok, registerRepo, run, setCapes, shoutPackage, tempBridge, waveCapeRepo } from "../test/harness.ts";
import { i01a133548178739398941123114401ad as usageId } from "./i01a133548178739398941123114401ad.ts";

const core: Cape = await sourceCape();

test("prefers the workspace without changing it, logs the source, and rebuilds uncommitted files", async () => {
	const repo = greetCapeRepo();
	const { dir } = await build(repo);
	const checkout = join(dir, "workspace", "greet-cape");
	mkdirSync(join(dir, "workspace"), { recursive: true });
	git(["clone", "-q", repo, checkout], dir);
	const bridge = findBridge(dir)!;
	const record = findRepoDoc(bridge, "greet-cape");
	const messages: string[] = [];
	const built = () => buildCape(bridge, record, "missing-remote-ref", core, [], (message) => messages.push(message));
	const before = git(["rev-parse", "HEAD"], checkout);
	const first = await built();
	assert.equal(first.source, checkout);
	assert.match(messages[0]!, /using workspace checkout/);
	assert.equal((await built()).fresh, false);
	const impl = join(checkout, "src", `i${usageId("greet <who>", GREET)}.ts`);
	writeFileSync(impl, readFileSync(impl, "utf8").replace("hello", "local hello"));
	const second = await built();
	assert.notEqual(second.id, first.id);
	assert.match(readFileSync(join(dir, ".nosedive", "capes", `${second.id}.js`), "utf8"), /local hello/);
	mkdirSync(join(checkout, "assets"));
	writeFileSync(join(checkout, "assets", "new.txt"), "new local asset");
	const third = await built();
	assert.notEqual(third.id, second.id);
	assert.equal((await built()).fresh, false);
	assert.equal(git(["rev-parse", "HEAD"], checkout), before);
	assert.match(git(["status", "--porcelain"], checkout), /src\//);
});

async function build(repo: string, ref = "") {
	const dir = await tempBridge("build-cape");
	await registerRepo(dir, "greet-cape", repo);
	const bridge = findBridge(dir)!;
	return { dir, built: () => buildCape(bridge, findRepoDoc(bridge, "greet-cape"), ref, core) };
}

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

test("refuses a repo whose root is not a cape", async () => {
	await assert.rejects((await build(greetCapeRepo({ plain: true }))).built(), /greet-cape is not a cape: it has no root/);
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

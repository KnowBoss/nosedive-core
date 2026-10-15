// build-cape
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import type { Cape } from "../src/a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "../src/a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a1337c81b57799820f96a757b791d0 as buildCape } from "../src/a01a1337c81b57799820f96a757b791d0.ts";
import { a01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "../src/a01a1337d2c14754f9772dc22c1f2edfc.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { git, greetCapeRepo, ok, registerRepo, run, setCapes, tempBridge, waveCapeRepo } from "./harness.ts";

const core: Cape = await sourceCape();

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

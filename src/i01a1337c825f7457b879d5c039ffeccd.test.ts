// find-cape
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import type { Cape, Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1337c825f7457b879d5c039ffeccd as findCape } from "./i01a1337c825f7457b879d5c039ffeccd.ts";
import { i01a13a6aba3a763595bd67a4ee4d47bf as findRoot } from "./i01a13a6aba3a763595bd67a4ee4d47bf.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { git, greetCapeRepo, ok, registerRepo, run, setCapes, tempBridge } from "../test/harness.ts";

const core: Cape = await sourceCape();
const ctxAt = (cwd: string) => ({ cwd }) as Ctx;

test("finds nothing for an action the config does not name", async () => {
	const bridge = await tempBridge("find-cape-none");
	assert.equal(await findCape(ctxAt(bridge), "greet", core), undefined);
});

test("loads the cape seed built, by manifest for a ref and by id for a commit", async () => {
	const bridge = await tempBridge("find-cape");
	const repo = greetCapeRepo();
	await registerRepo(bridge, "greet-cape", repo);
	setCapes(bridge, ["greet-cape"]);
	assert.equal(await findCape(ctxAt(bridge), "greet", core), undefined, "nothing is built yet");
	ok(await run(["seed"], bridge));

	const cape = (await findCape(ctxAt(bridge), "greet", core))!;
	const commit = git(["rev-parse", "HEAD"], repo);
	assert.equal(cape.name, "greet-cape");
	assert.equal(cape.commit, commit);
	assert.equal(Object.values(cape.docs)[0]!.name, "greet");

	setCapes(bridge, [`greet-cape@${commit}`]);
	assert.equal((await findCape(ctxAt(bridge), "greet", core))!.id, cape.id);
});

/** A cape repo of `greet` named `name`, superseding the repos given. */
const greeting = (name: string, ...supersedes: string[]) => greetCapeRepo({ name, supersedes: supersedes.map((repo) => readRepoConfig(repo)!.id!) });

/** A hero wearing the repos, registered and worn by their root names, seeded. */
async function wearing(label: string, ...repos: string[]): Promise<string> {
	const bridge = await tempBridge(label);
	const names = repos.map((repo) => String(findRoot(repo, "cape")!.fm.name));
	for (const [index, repo] of repos.entries()) await registerRepo(bridge, names[index]!, repo);
	setCapes(bridge, names);
	ok(await run(["seed"], bridge));
	return bridge;
}

test("a shared action name is refused without a supersedes link, and goes to the superseding cape with one", async () => {
	const old = greeting("old-greet");
	const plain = await wearing("find-cape-plain", old, greeting("new-greet"));
	await assert.rejects(findCape(ctxAt(plain), "greet", core), /greet is an action of old-greet and new-greet: name one, as `old-greet:greet` or `new-greet:greet`/);

	const bridge = await wearing("find-cape-supersedes", old, greeting("new-greet", old));
	assert.equal((await findCape(ctxAt(bridge), "greet", core))!.name, "new-greet");
	assert.equal((await findCape(ctxAt(bridge), "greet", core, "old-greet"))!.name, "old-greet", "the superseded cape is still reached by name");
	assert.equal((await findCape(ctxAt(bridge), "greet", core, "new-greet"))!.name, "new-greet");
	assert.match(ok(await run(["greet", "ann"], bridge)), /^hello ann /);
	assert.match(ok(await run(["old-greet:greet", "ann"], bridge)), /^hello ann /);
});

test("a supersedes naming a cape the hero does not wear changes nothing", async () => {
	const bridge = await wearing("find-cape-unworn", greeting("old-greet"), greeting("new-greet", greeting("unworn")));
	await assert.rejects(findCape(ctxAt(bridge), "greet", core), /greet is an action of old-greet and new-greet: name one/);
});

test("capes superseding each other are refused, naming both", async () => {
	const a = greeting("old-greet");
	const b = greeting("new-greet", a);
	// a's root can name b only once b has an id: link it back by hand.
	const root = findRoot(a, "cape")!.path;
	writeFileSync(root, readFileSync(root, "utf8").replace("---\n", `---\nlinks:\n  - ${readRepoConfig(b)!.id}:\n      rel: supersedes.cape\n`));
	git(["commit", "-qam", "supersede b"], a);
	const bridge = await wearing("find-cape-mutual", a, b);
	await assert.rejects(findCape(ctxAt(bridge), "greet", core), /greet is an action of old-greet and new-greet, which supersede each other: name one, as `old-greet:greet` or `new-greet:greet`/);
	assert.equal((await findCape(ctxAt(bridge), "greet", core, "old-greet"))!.name, "old-greet");
});

test("two capes superseding a third and sharing the name are refused as an ordinary clash, the third left out", async () => {
	const old = greeting("old-greet");
	const bridge = await wearing("find-cape-competing", old, greeting("new-greet", old), greeting("third-greet", old));
	await assert.rejects(findCape(ctxAt(bridge), "greet", core), /greet is an action of new-greet and third-greet: name one/);
});

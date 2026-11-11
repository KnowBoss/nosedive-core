// crud --read <quid>
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { cachePath } from "../src/i01a15baf13e27bd88dc880d4871f2210.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "../src/i01a13dee4b1d78f7a699c3777bf63587.ts";
import { relinked } from "./ibccbde44f93254e0bb6a2af910bc03d9.ts";
import { git, greetCapeRepo, GREET, ok, registerRepo, run, setCapes, tempBridge, tempDir } from "../test/harness.ts";

const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");
/** Every inline link target of a text, its fragment dropped. */
const targets = (text: string) => [...text.matchAll(/\]\(([^)#]+)[^)]*\)/g)].map((match) => match[1]!);

test("prints a hero doc's title and body, no front matter, its relative links rewritten to resolve from the cwd, and writes nothing", async () => {
	const bridge = await tempBridge("crud-read-links");
	const a = ok(await run(["crud", "core:memo", "reads", "well"], bridge));
	const b = ok(await run(["crud", "core:memo", "is", "linked"], bridge));
	writeFileSync(join(bridge, "notes.txt"), "notes\n");
	const body = [
		`See [b](${idOf(b)}.md), [its part](${idOf(b)}.md#part) and [notes](../notes.txt).`,
		"",
		"[site](https://example.com/a.md) [anchor](#here) [rooted](/etc/a.md) [other repo](some-repo:kb/a.md)",
		"",
		`A span: \`[code](${idOf(b)}.md)\` then [after](${idOf(b)}.md).`,
		"",
		"```md",
		`[fenced](${idOf(b)}.md)`,
		"```",
		"",
		`[ref]: ${idOf(b)}.md`,
		"[^1]: a footnote",
	].join("\n");
	const file = join(bridge, a);
	writeFileSync(file, `${readFileSync(file, "utf8")}\n${body}\n`);
	git(["add", "-A"], bridge);
	git(["commit", "-qm", "links"], bridge);
	const cwd = join(bridge, "some", "where");
	mkdirSync(cwd, { recursive: true });

	const text = ok(await run(["crud", "--read", idOf(a)], cwd));
	const linked = `../../${b}`;
	assert.equal(
		text,
		[
			"# reads well",
			"",
			`See [b](${linked}), [its part](${linked}#part) and [notes](../../notes.txt).`,
			"",
			"[site](https://example.com/a.md) [anchor](#here) [rooted](/etc/a.md) [other repo](some-repo:kb/a.md)",
			"",
			`A span: \`[code](${idOf(b)}.md)\` then [after](${linked}).`,
			"",
			"```md",
			`[fenced](${idOf(b)}.md)`,
			"```",
			"",
			`[ref]: ${linked}`,
			"[^1]: a footnote",
		].join("\n"),
	);
	for (const target of [linked, "../../notes.txt"]) assert.ok(existsSync(resolve(cwd, target)), `${target} resolves from the cwd`);
	assert.equal(git(["status", "--porcelain"], bridge), "", "writes nothing");
	assert.equal(ok(await run(["crud", "--read", a], bridge)).split("\n")[2], `See [b](${b}), [its part](${b}#part) and [notes](notes.txt).`, "a doc's path is its quid, and the hero's own directory a cwd like any other");
});

test("prints a cape's doc from where the cape is checked out, its links resolving from a cwd outside it", async () => {
	const cwd = tempDir("crud-read-cape-links");
	const text = ok(await run(["crud", "--read", "01a13354-7dea-7604-b903-b94a5aca2b83"], cwd));
	assert.match(text, /^# Crud\n\n## Usage\n/);
	assert.doesNotMatch(text, /^(---|kind: action|id: )/m);
	const code = targets(text.slice(text.indexOf("## Code")));
	assert.ok(code.length > 40, "its Code section links each usage's impl and tests");
	for (const target of code) assert.ok(existsSync(resolve(cwd, target)), `${target} resolves from the cwd`);
	assert.doesNotMatch(text, /\]\(\.\.\/src\//, "none is left relative to the doc");
});

/** A hero wearing greet-cape, seeded so the cape is built from its repo's clone and has no checkout; its user dir is its own. */
async function wearingBuilt(label: string) {
	process.env.NOSEDIVE_USER_DIR = tempDir(`${label}-user`);
	const bridge = await tempBridge(label);
	const origin = greetCapeRepo();
	const repoId = await registerRepo(bridge, "greet-cape", origin);
	setCapes(bridge, ["greet-cape"]);
	git(["add", "-A"], bridge);
	git(["commit", "-qm", "wear greet-cape"], bridge);
	ok(await run(["seed"], bridge));
	const built = git(["rev-parse", "HEAD"], origin);
	const heroName = /^name: (.+)$/m.exec(readFileSync(readRepoConfig(bridge)!.roots.find((root) => root.id === readRepoConfig(bridge)!.root)!.path, "utf8"))![1]!;
	const dock = join(process.env.NOSEDIVE_USER_DIR, "docks", heroName, "greet-cape");
	return { bridge, origin, repoId, built, dock };
}

test("prints a worn built cape's doc with its links resolving into its repo, docked read-only at the commit it was built at", async () => {
	const { bridge, origin, built, dock } = await wearingBuilt("crud-read-built");
	// The origin moves on after the build, so the dock's commit is the build's and not trunk's.
	writeFileSync(join(origin, "later.md"), "later\n");
	git(["add", "-A"], origin);
	git(["commit", "-qm", "later"], origin);
	const cwd = join(bridge, "some", "where");
	mkdirSync(cwd, { recursive: true });

	const result = await run(["crud", "--read", GREET], cwd);
	assert.equal(result.code, 0, result.err);
	assert.match(result.out, /^# Greet\n/);
	assert.doesNotMatch(result.out, /detached at/, "stdout is the doc alone");
	assert.match(result.err, /detached at/, "the dock's report goes to stderr");
	assert.equal(git(["rev-parse", "HEAD"], dock), built);
	assert.equal(git(["rev-parse", "--abbrev-ref", "HEAD"], dock), "HEAD", "detached");
	const code = targets(result.out.slice(result.out.indexOf("## Code")));
	assert.ok(code.length > 0);
	for (const target of code) {
		assert.doesNotMatch(target, /^\.\.\/src\//, "no longer relative to the doc");
		assert.ok(existsSync(resolve(cwd, target)), `${target} resolves from the cwd`);
		assert.ok(resolve(cwd, target).startsWith(dock), `${target} is in the dock`);
	}
	assert.equal(git(["status", "--porcelain"], bridge), "", "writes nothing in the hero");
});

test("uses a dock already there that holds the doc as it is, at whatever head it is", async () => {
	const { bridge, origin, repoId, dock } = await wearingBuilt("crud-read-docked");
	writeFileSync(join(origin, "later.md"), "later\n");
	git(["add", "-A"], origin);
	git(["commit", "-qm", "later"], origin);
	const later = git(["rev-parse", "HEAD"], origin);
	ok(await run(["dock", repoId], bridge));
	assert.equal(git(["rev-parse", "HEAD"], dock), later);

	const result = await run(["crud", "--read", GREET], bridge);
	assert.equal(result.code, 0, result.err);
	assert.equal(result.err, "", "nothing is docked, so nothing is said");
	assert.equal(git(["rev-parse", "HEAD"], dock), later, "not moved to the build's commit");
	const impl = targets(result.out).find((target) => /src\/i[0-9a-f]{32}\.ts$/.test(target))!;
	assert.ok(existsSync(resolve(bridge, impl)) && resolve(bridge, impl).startsWith(dock), "its links resolve into the existing dock");
	assert.equal(git(["status", "--porcelain"], bridge), "");
});

test("prints a worn built cape's links as written, with a line on stderr, when its repo cannot be docked", async () => {
	const { bridge, origin, dock } = await wearingBuilt("crud-read-undockable");
	// Its remote gone and its cache with it: nothing to fetch from or dock out of.
	rmSync(origin, { recursive: true, force: true });
	rmSync(cachePath(origin), { recursive: true, force: true });

	const result = await run(["crud", "--read", GREET], bridge);
	assert.equal(result.code, 0, result.err);
	assert.match(result.out, /^# Greet\n/);
	assert.match(result.out, /\[impl\]\(\.\.\/src\/i[0-9a-f]{32}\.ts\)/);
	assert.match(result.err, /^nosedive: cannot dock greet-cape at [0-9a-f]{12} to resolve the links of 01a1337c-830d-7ef7-b5b2-ab0bc3a666e9, so they are as written: cannot fetch greet-cape/);
	assert.equal(existsSync(dock), false);
});

test("prints a worn built cape's links as written when the hero has no repo doc named as the cape is", async () => {
	const { bridge, repoId } = await wearingBuilt("crud-read-no-repo-doc");
	const file = join(bridge, ".nosedive", "repos", `${repoId}.md`);
	writeFileSync(file, readFileSync(file, "utf8").replace("name: greet-cape", "name: renamed"));
	const result = await run(["crud", "--read", GREET], bridge);
	assert.equal(result.code, 0, result.err);
	assert.match(result.out, /\[impl\]\(\.\.\/src\/i[0-9a-f]{32}\.ts\)/);
	assert.match(result.err, /so they are as written: the hero has no repo doc named greet-cape/);
});

test("says where it looked when the doc is nowhere, and refuses what is not a quid", async () => {
	const missing = await run(["crud", "--read", "01a1335b-f3bd-7ef4-9eb1-98115e3ba276"], await tempBridge("crud-read-nowhere"));
	assert.equal(missing.code, 1);
	assert.match(missing.err, /no doc 01a1335b-f3bd-7ef4-9eb1-98115e3ba276 in this bridge, its workspace or the loaded capes/);
	assert.match((await run(["crud", "--read", "nope"], tempDir("crud-read-not-a-quid"))).err, /not a quid: nope/);
});

test("relinked keeps a fragment, angle brackets and a title, brackets a path with a space, and leaves a longer fence open", () => {
	const from = resolve("docs", "kb");
	const to = resolve("my work");
	assert.equal(relinked('[a](<x y.md#top> "A") [b](../b.md "B") ![c](c.png)', from, to), '[a](<../docs/kb/x y.md#top> "A") [b](../docs/b.md "B") ![c](../docs/kb/c.png)');
	assert.equal(relinked("[a](a.md)", resolve("my work", "kb"), resolve("docs")), "[a](<../my work/kb/a.md>)");
	assert.equal(relinked("[here](.)", from, from), "[here](.)");
	assert.equal(relinked("````\n```\n[a](a.md)\n````\n[b](a.md)", from, resolve("docs")), "````\n```\n[a](a.md)\n````\n[b](kb/a.md)");
});

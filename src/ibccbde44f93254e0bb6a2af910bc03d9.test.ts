// crud --read <quid>
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
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

test("prints a doc that has no file on disk, a worn cape's from its build, with its links as written", async () => {
	const bridge = await tempBridge("crud-read-built");
	await registerRepo(bridge, "greet-cape", greetCapeRepo());
	setCapes(bridge, ["greet-cape"]);
	git(["add", "-A"], bridge);
	git(["commit", "-qm", "wear greet-cape"], bridge);
	ok(await run(["seed"], bridge));
	const text = ok(await run(["crud", "--read", GREET], bridge));
	assert.match(text, /^# Greet\n/);
	assert.match(text, /\[impl\]\(\.\.\/src\/i[0-9a-f]{32}\.ts\)/);
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

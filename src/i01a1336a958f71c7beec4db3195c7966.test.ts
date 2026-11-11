// launch
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { test } from "node:test";
import { consoleCtx, i01a1336a958f71c7beec4db3195c7966 as launch, type Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./i01a1335480147d0686528aee80f8ee34.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { greetCapeRepo, kbOf, ok, registerRepo, run, setCapes, tempBridge, tempDir } from "../test/harness.ts";

test("lists core's top-level actions, never internal functions", async () => {
	const out = ok(await run([], tempDir("launch-help")));
	assert.match(out, /^Usage: nosedive \[--at <target>\] <action> \[<args>\]\n\ncore\n {2}crud {2}Reads, mints and edits kb docs\n {2}dock {2}Checks out a repo[^\n]*\n {2}mint {2}Prints new uuid v7 ids/);
	assert.doesNotMatch(out, /\n {2}scaf /, "seed scaffolds now (seed-scaffolds-capes)");
	assert.match(out, /\n {2}seed {2}Makes the current git repo a bridge/);
	assert.doesNotMatch(out, /match-usage|launch/);
});

test("lists the actions of the capes config names under each cape, once built, from the manifest", async () => {
	const bridge = await tempBridge("launch-help-capes");
	await registerRepo(bridge, "greet-cape", greetCapeRepo());
	setCapes(bridge, ["greet-cape"]);
	assert.match(ok(await run(["help"], bridge)), /\n\ngreet-cape\n {2}not built: run `nosedive seed`\n/);
	ok(await run(["seed"], bridge));
	const help = ok(await run(["help"], bridge));
	assert.match(help, /\n\ngreet-cape\n {2}greet {2}Greets\n/, "no version: plain help is the agent surface");
	assert.match(ok(await run(["--help", "--more"], bridge)), /\n\ngreet-cape \S+\n {2}trunk at [0-9a-f]{12}, repo [0-9a-f-]{36}\n {2}greet {2}Greets\n/);
	assert.doesNotMatch(help, /not built/);
});

test("heads a cape in help by its short name, the name of its root doc, not its repo's", async () => {
	const bridge = await tempBridge("launch-help-short");
	await registerRepo(bridge, "greet-cape", greetCapeRepo({ name: "greet" }));
	setCapes(bridge, ["greet-cape"]);
	ok(await run(["seed"], bridge));
	assert.match(ok(await run(["help"], bridge)), /\n\ngreet\n {2}greet {2}Greets\n/);
	assert.doesNotMatch(ok(await run(["help"], bridge)), /\n\ngreet-cape/);
});

test("--help lists an action's usages, each with its summary, and names --help --more", async () => {
	const dir = tempDir("launch-action-help");
	const help = ok(await run(["seed", "--help"], dir));
	assert.equal(help, "Makes the current git repo a bridge, or brings an existing bridge's setup up to date\n\n  seed [--no-capes] [--root-kind <kind>] [--workspace] [--migrate] [--no-migrate]\n    Makes the current git repo a hero, or brings a seeded repo's setup up to date.\n\nnosedive seed --help --more for each usage's attributes and hash.");
});

test("--help --more adds under each usage its @nosedive- attributes and hash, then the ## Usage section, and names the hash form", async () => {
	const dir = tempDir("launch-action-help-more");
	const help = ok(await run(["mint", "--help", "--more"], dir));
	assert.match(help, /^Prints new uuid v7 ids, one per successive millisecond\n\n {2}mint \[<count>\] \[--ms <utcmillis>\] \[--ts <iso8601>\]\n {4}Prints new uuid v7 ids, one per successive millisecond\.\n {4}feat: 01a1336b-c0b8-7cde-b7c6-285196062297\n {4}hash: udbb1d37c\n\n/);
	assert.match(help, /\n\nPrints `<count>` ids \(one by default\)[^\n]*\n\nnosedive mint --help --more <u-hash> prints the rest of a usage's block\.$/);
	assert.match(ok(await run(["seed", "--help", "--more"], dir)), /\n {4}hash: ue4a628f2\n\nSeed runs every pending migration[^]*\n\nnosedive seed --help --more <u-hash> prints the rest of a usage's block\.$/);
});

test("--help --more u<hash> prints that usage's whole block, by any prefix of 4 or more hex digits", async () => {
	const dir = tempDir("launch-usage-block");
	const block = ok(await run(["crud", "--help", "--more", "u4566acc2"], dir));
	assert.equal(
		block,
		[
			"crud <quid> --meta:<path> <value>... [--section:<path> <source>]...",
			"hash: u4566acc2",
			"",
			"Sets values in a doc's meta by dot path, and writes sections, in one edit.",
			"",
			"Each value is read as YAML, a null removing the key, and merged as `--meta` does; each section text is written as `--section:<path>` does.",
			"",
			"Params",
			"  edit      The edit this change is made in, which the caller commits.",
			"  quid      The doc to change: its quid, or a path ending `<quid>.md`.",
			"  meta      Each dot path to the value as typed.",
			"  sections  Each section path to its text.",
			"  ctx       Where it runs, and how it reads and prints.",
			"",
			"Returns",
			"  Nothing; the change is in the edit.",
			"",
			"feat: 01a1336b-c0b8-7cde-b7c6-285196062297",
		].join("\n"),
	);
	assert.equal(ok(await run(["crud", "--help", "--more", "u4566"], dir)), block, "a shorter prefix");
	assert.equal(ok(await run(["crud", "--help", "--more", "U4566"], dir)), block, "in any case");
});

/** A cape standing in for core, whose action `tool` has the usages given. */
function toolCape(usages: { id: string; text: string; description?: { summary: string } }[]): Cape {
	const docId = "01a1335b-f253-7b80-ab64-d2f9a03c9634";
	const id = "01a1335b-f30a-7dd2-a1d4-b675fd419238";
	const doc = { kind: "action" as const, name: "tool", gist: "Does a thing", usages, top: true, text: "", body: "# Tool\n\n## Usage\n\nIts prose.\n" };
	return { id, name: "nosedive-core", commit: "", version: "v", docs: { [docId]: doc }, index: { [namespacedUuid("tool", id)]: docId }, kinds: {} };
}

async function helpOf(cape: Cape, argv: string[]): Promise<{ code: number; out: string; err: string }> {
	const [out, err]: string[][] = [[], []];
	const code = await launch(argv, { cwd: tempDir("launch-tool"), capes: [cape], out: (text) => out.push(text), err: (text) => err.push(text), stdin: async () => "" });
	return { code, out: out.join("\n"), err: err.join("\n") };
}

test("--help --more u<hash> refuses a prefix that is unknown, too short or ambiguous, naming the usages", async () => {
	const cape = toolCape([
		{ id: "abcd0000000000000000000000000001", text: "tool one", description: { summary: "One." } },
		{ id: "abcd1111111111111111111111111111", text: "tool two <x>" },
		{ id: "ffff2222222222222222222222222222", text: "tool three" },
	]);
	const ambiguous = await helpOf(cape, ["tool", "--help", "--more", "uabcd"]);
	assert.equal(ambiguous.code, 1);
	assert.equal(ambiguous.err, "nosedive: uabcd starts the hash of 2 usages of tool; give more of it:\n  uabcd0000  tool one\n  uabcd1111  tool two <x>");
	assert.match(ok(await helpOf(cape, ["tool", "--help", "--more", "uabcd0"])), /^tool one\nhash: uabcd0000\n\nOne\.$/);
	const unknown = await helpOf(cape, ["tool", "--help", "--more", "u0123"]);
	assert.equal(unknown.err, "nosedive: no usage of tool has a hash starting u0123; its usages:\n  uabcd0000  tool one\n  uabcd1111  tool two <x>\n  uffff2222  tool three");
	for (const bad of ["uabc", "abcd0000", "u", "uxyzw"]) assert.match((await helpOf(cape, ["tool", "--help", "--more", bad])).err, /--help --more takes one usage hash, u and at least 4 hex digits/, bad);
	assert.match((await helpOf(cape, ["tool", "--help", "--more", "uabcd0", "uffff"])).err, /takes one usage hash/);
});

test("a usage with no block shows nothing beside it in --help, only its hash in --more, and the gist when its block is asked for", async () => {
	const cape = toolCape([
		{ id: "abcd0000000000000000000000000001", text: "tool one", description: { summary: "One." } },
		{ id: "ffff2222222222222222222222222222", text: "tool three" },
	]);
	assert.equal(ok(await helpOf(cape, ["tool", "--help"])), "Does a thing\n\n  tool one\n    One.\n  tool three\n\nnosedive tool --help --more for each usage's attributes and hash.");
	assert.equal(
		ok(await helpOf(cape, ["tool", "--help", "--more"])),
		"Does a thing\n\n  tool one\n    One.\n    hash: uabcd0000\n  tool three\n    hash: uffff2222\n\nIts prose.\n\nnosedive tool --help --more <u-hash> prints the rest of a usage's block.",
	);
	assert.equal(ok(await helpOf(cape, ["tool", "--help", "--more", "uffff2"])), "tool three\nhash: uffff2222\n\nDoes a thing\n\nIts impl file has no jsdoc block.");
});

test("a build taken without its source still shows each usage's summary, attributes and hash, and its block", async () => {
	const bridge = await tempBridge("launch-built-block");
	const repo = greetCapeRepo({ blocked: true });
	await registerRepo(bridge, "greet-cape", repo);
	setCapes(bridge, ["greet-cape"]);
	ok(await run(["seed"], bridge));
	// Nothing of the cape's source is read from here on: help reads what the build carries.
	rmSync(join(bridge, ".nosedive", "capes", "src"), { recursive: true, force: true });
	rmSync(repo, { recursive: true, force: true });
	assert.match(ok(await run(["greet", "--help"], bridge)), /^Greets\n\n {2}greet <who>\n {4}Greets someone by name\.\n\nnosedive greet --help --more for each/);
	const more = ok(await run(["greet", "--help", "--more"], bridge));
	assert.match(more, /\n {2}greet <who>\n {4}Greets someone by name\.\n {4}feat: 01a1337c-830d-7ef7-b5b2-ab0bc3a666e9\n {4}hash: u[0-9a-f]{8}\n/);
	const hash = /hash: (u[0-9a-f]{8})/.exec(more)![1]!;
	assert.match(ok(await run(["greet", "--help", "--more", hash], bridge)), /^greet <who>\nhash: u[0-9a-f]{8}\n\nGreets someone by name\.\n\nTells who it is to hello\.\n\nParams\n {2}who {2}Who to greet\.\n {2}ctx {2}Where to print\.\n\nReturns\n {2}Nothing\.\n\nfeat: 01a1337c/);
});

test("--at selects one of the hero's roots by directory, name or quid, else a directory in the hero for crud to write into; NOSEDIVE_HERO names the repo to act on", async () => {
	const bridge = await tempBridge("launch-base");
	try {
		assert.match((await run(["--at", "nope", "help"], bridge)).err, /--at names one of the hero's roots, by quid, name or directory, or a directory in the hero or its workspace, and nope is none/);
		assert.match((await run(["--at", "..", "help"], bridge)).err, /and \.\. is none/, "a directory outside the hero");
		const path = ok(await run(["--at", relative(bridge, kbOf(bridge)), "crud", "core:memo", "Home"], bridge));
		assert.equal(dirname(join(bridge, path)), kbOf(bridge));
		const home = findBridge(bridge)!;
		assert.equal(home.targetDir, home.kbDir);
		mkdirSync(join(bridge, "notes"));
		assert.match(ok(await run(["--at", "notes", "crud", "core:memo", "Apart"], bridge)), /^notes\/[0-9a-f-]{36}\.md$/);
		assert.equal(process.env.NOSEDIVE_AT, undefined, "--at holds for one command line");
		process.env.NOSEDIVE_AT = join(bridge, "notes");
		const plain = findBridge(bridge)!;
		assert.deepEqual([plain.targetDir, plain.activeRoot], [join(bridge, "notes"), home.root], "a plain directory is written to, and the primary root's capes are worn");
	} finally {
		delete process.env.NOSEDIVE_AT;
	}
	const before = process.env.NOSEDIVE_HERO;
	process.env.NOSEDIVE_HERO = bridge;
	try {
		assert.equal(consoleCtx([]).cwd, bridge);
	} finally {
		if (before === undefined) delete process.env.NOSEDIVE_HERO;
		else process.env.NOSEDIVE_HERO = before;
	}
});

test("refuses an unknown action, and an internal function by name", async () => {
	const dir = tempDir("launch-unknown");
	for (const name of ["nope", "match-usage"]) {
		const result = await run([name], dir);
		assert.equal(result.code, 1);
		assert.match(result.err, new RegExp(`^nosedive: unknown action: ${name}\n`));
	}
});

test("lists an action a worn cape supersedes once, under the superseding cape, and --help --more says whose it replaces", async () => {
	const old = greetCapeRepo({ name: "old-greet" });
	const bridge = await tempBridge("launch-help-supersedes");
	await registerRepo(bridge, "old-greet", old);
	await registerRepo(bridge, "new-greet", greetCapeRepo({ name: "new-greet", supersedes: [readRepoConfig(old)!.id!] }));
	setCapes(bridge, ["old-greet", "new-greet"]);
	ok(await run(["seed"], bridge));
	const help = ok(await run(["help"], bridge));
	assert.equal(help.match(/ {2}greet {2}Greets/g)?.length, 1, "listed once");
	assert.match(help, /\n\nold-greet\n\nnew-greet\n {2}greet {2}Greets\n/);
	assert.match(ok(await run(["--help", "--more"], bridge)), /\n\nnew-greet \S+\n[^\n]*\n {2}greet {2}Greets \(in place of old-greet's\)\n/);

	// Without the link both stay listed, as the clash is the hero's to see.
	setCapes(bridge, ["old-greet"]);
	assert.match(ok(await run(["help"], bridge)), /\n\nold-greet\n {2}greet {2}Greets\n/, "a cape no worn cape supersedes lists its own");
});

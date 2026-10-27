// launch
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { test } from "node:test";
<<<<<<< HEAD
import { consoleCtx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { greetCapeRepo, kbOf, ok, registerRepo, run, setCapes, tempBridge, tempDir } from "../test/harness.ts";
=======
import { i01a1336a958f71c7beec4db3195c7966 as launch, type Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./i01a1335480147d0686528aee80f8ee34.ts";
import { greetCapeRepo, ok, registerRepo, run, setCapes, tempBridge, tempDir } from "../test/harness.ts";
>>>>>>> 13be5cf (Refuse prepared KB edits when their read inputs change)

test("in-process consumers observe the original structured failure while CLI output stays unchanged", async () => {
	const id="01a175bf-0635-70c8-9c81-4db4184d47ce", action="01a175bf-0635-70c8-9c81-4db4184d47cf";
	const failure=Object.assign(new Error("document changed"),{code:"REPOSITORY_CHANGED",outcome:"not_applied",status:409});
	const cape:Cape={id,name:"test",commit:"",version:"",kinds:{},docs:{[action]:{kind:"action",name:"fail",gist:"test",top:true,text:"",body:"",usages:[{id:action,text:"fail"}]}},index:{
		[namespacedUuid("fail",id)]:action,[namespacedUuid(action,id)]:()=>{throw failure;},
	}};
	let observed:unknown;const errors:string[]=[];
	const code=await launch(["fail"],{cwd:tempDir("launch-observer"),capes:[cape],out(){},err:text=>{errors.push(text);},stdin:async()=>"",failure:error=>{observed=error;}});
	assert.equal(code,1);assert.equal(observed,failure);assert.deepEqual(errors,["nosedive: document changed"]);
});

test("lists core's top-level actions, never internal functions", async () => {
	const out = ok(await run([], tempDir("launch-help")));
	assert.match(out, /^Usage: nosedive \[--at <target>\] <action> \[<args>\]\n\ncore \S+\n {2}crud {2}Reads, mints and edits kb docs\n {2}mint {2}Prints new uuid v7 ids/);
	assert.match(out, /\n {2}scaf {2}Writes the files/);
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
	assert.match(help, /\n\ngreet-cape \S+\n {2}greet {2}Greets\n/);
	assert.match(ok(await run(["--help", "--more"], bridge)), /\n\ngreet-cape \S+\n {2}trunk at [0-9a-f]{12}, repo [0-9a-f-]{36}\n {2}greet {2}Greets\n/);
	assert.doesNotMatch(help, /not built/);
});

test("heads a cape in help by its short name, the name of its root doc, not its repo's", async () => {
	const bridge = await tempBridge("launch-help-short");
	await registerRepo(bridge, "greet-cape", greetCapeRepo({ name: "greet" }));
	setCapes(bridge, ["greet-cape"]);
	ok(await run(["seed"], bridge));
	assert.match(ok(await run(["help"], bridge)), /\n\ngreet \S+\n {2}greet {2}Greets\n/);
	assert.doesNotMatch(ok(await run(["help"], bridge)), /\n\ngreet-cape/);
});

test("--help lists an action's usages and names --help --more, which adds its ## Usage section", async () => {
	const dir = tempDir("launch-action-help");
	const help = ok(await run(["scaf", "--help"], dir));
	assert.equal(help, "Writes the files a seeded repo's action docs call for and do not have yet\n\n  scaf [<quid>]\n\nnosedive scaf --help --more for what each usage does.");
	assert.match(ok(await run(["scaf", "--help", "--more"], dir)), /\n\n`nosedive \[--at <dir>\] scaf \[<quid>\]` walks the tree /);
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

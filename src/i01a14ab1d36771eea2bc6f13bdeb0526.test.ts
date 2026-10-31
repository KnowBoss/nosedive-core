// edit-kb-docs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { appendFileSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "./i01a133588bcc7f8bae725ff70d8f6800.ts";
import { i01a14ab1d36771eea2bc6f13bdeb0526 as editKbDocs } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { checkedOut, git, ok, run, tempBridge, tempDir, kbOf, kbPath } from "../test/harness.ts";

const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");
const WORKSPACE_DOC = "01a14ab4-cb92-7dba-bd33-79535603579d";
const UNTRACKED = "01a14ab4-ce62-7712-b43f-3045d0a1fa4d";

const isConflict = (error: unknown) => {
	assert.equal((error as { code: string }).code, "REPOSITORY_CHANGED");
	assert.equal((error as { outcome: string }).outcome, "not_applied");
	return true;
};

test("protected saves exclude a competing process through commit, including unchanged dependencies", {skip:process.platform!=="win32"}, async () => {
	const bridge=await tempBridge("protected-save");
	const target=ok(await run(["crud", "core:memo","target"],bridge));
	const dependency=ok(await run(["crud", "core:memo","dependency"],bridge));
	const targetPath=join(bridge,target),dependencyPath=join(bridge,dependency);
	const dependencyText=readFileSync(dependencyPath,"utf8");
	const probe=join(bridge,".git","probe.cjs"),result=join(bridge,".git","probe.json");
	writeFileSync(probe,`const fs=require('node:fs');const results=[];
for(const path of process.argv.slice(3)) {
 for(const act of ['write','rename','delete']) {
  let blocked=false;
  try {if(act==='write')fs.writeFileSync(path,'external overwrite');
   if(act==='rename'){const other=path+'.swap';fs.writeFileSync(other,'external atomic save');try{fs.renameSync(other,path);}finally{try{fs.unlinkSync(other);}catch{}}}
   if(act==='delete')fs.unlinkSync(path);
  } catch(error) {blocked=true;}
  results.push({act,blocked});
 }
}fs.writeFileSync(process.argv[2],JSON.stringify(results));`);
	const quote=(text:string)=>"'"+text.replace(/'/g,"'\\''")+"'";
	writeFileSync(join(bridge,".git","hooks","pre-commit"),`#!/bin/sh\n${[process.execPath,probe,result,targetPath,dependencyPath].map(path=>quote(path.replace(/\\/g,"/"))).join(" ")}\n`);
	const edit=editKbDocs(bridge,"test",{exclusive:true});edit.doc(idOf(dependency));
	updateKbDocField(edit,idOf(target),"gist",()=>"protected proposal");
	edit.commit({action:"crud",what:'protected "quoted" message'});
	const attempts=JSON.parse(readFileSync(result,"utf8")) as {act:string;blocked:boolean}[];
	assert.equal(attempts.length,6);assert.ok(attempts.every(attempt=>attempt.blocked),JSON.stringify(attempts));
	assert.match(readFileSync(targetPath,"utf8"),/gist: "?protected proposal/);
	assert.equal(readFileSync(dependencyPath,"utf8"),dependencyText);
	assert.match(git(["log","-1","--format=%s"],bridge),/protected "quoted" message/);
	assert.match(git(["log","-1","--format=%B"],bridge),/Co-Authored-By: nosedive test <noreply@nosedive\.dev>/);
	appendFileSync(targetPath,"\nEditor can save after release\n");
	assert.match(readFileSync(targetPath,"utf8"),/Editor can save after release/);
});

test("protected save refuses an already open external writer without changing anything", {skip:process.platform!=="win32"}, async () => {
	const bridge=await tempBridge("protected-busy");const path=ok(await run(["crud", "core:memo","target"],bridge));
	const dependency=ok(await run(["crud", "core:memo","busy dependency"],bridge));
	const full=join(bridge,path),original=readFileSync(full,"utf8"),head=git(["rev-parse","HEAD"],bridge);
	const edit=editKbDocs(bridge,"test",{exclusive:true});updateKbDocField(edit,idOf(path),"gist",()=>"must refuse");edit.doc(idOf(dependency));
	const writer=spawn(process.execPath,["-e","require('node:fs').openSync(process.argv[1],'r+');console.log('ready');setInterval(()=>{},1000)",join(bridge,dependency)],{stdio:["ignore","pipe","pipe"]});
	try {
		await once(writer.stdout,"data");
		assert.throws(()=>edit.commit(),isConflict);
		assert.equal(readFileSync(full,"utf8"),original);assert.equal(git(["rev-parse","HEAD"],bridge),head);
	} finally {const exited=once(writer,"exit");writer.kill("SIGKILL");await exited;}
	assert.deepEqual(edit.commit(),[path],"a refusal releases earlier handles so a reviewed retry can save");
});

test("a protected commit failure after writing remains unknown", {skip:process.platform!=="win32"}, async () => {
	const bridge=await tempBridge("protected-failure"),path=ok(await run(["crud", "core:memo","target"],bridge));
	const head=git(["rev-parse","HEAD"],bridge);
	writeFileSync(join(bridge,".git","hooks","pre-commit"),"#!/bin/sh\nexit 1\n");
	const edit=editKbDocs(bridge,"test",{exclusive:true});updateKbDocField(edit,idOf(path),"gist",()=>"written but not committed");
	assert.throws(()=>edit.commit(),error=>(error as {outcome:string}).outcome==="unknown");
	assert.match(readFileSync(join(bridge,path),"utf8"),/written but not committed/);
	assert.equal(git(["rev-parse","HEAD"],bridge),head);
});

test("refuses an external edit made after preparation and preserves the external text", async () => {
	const bridge = await tempBridge("edit-stale");
	const path = ok(await run(["crud", "core:memo", "original"], bridge));
	const full = join(bridge, path), head = git(["rev-parse", "HEAD"], bridge);
	const edit = editKbDocs(bridge,"test");
	updateKbDocField(edit, idOf(path), "gist", () => "stale proposal");
	const external = readFileSync(full, "utf8") + "\nExternal draft\n";
	writeFileSync(full, external);
	// Mutating a public field cannot replace the private precondition.
	edit.doc(idOf(path)).text = external;
	assert.throws(() => edit.commit(), isConflict);
	assert.equal(readFileSync(full, "utf8"), external);
	assert.equal(git(["rev-parse", "HEAD"], bridge), head);
});

test("validates unchanged read dependencies before writing a different document", async () => {
	const bridge = await tempBridge("edit-read-set");
	const path = ok(await run(["crud", "core:memo", "target"], bridge));
	const dependency = ok(await run(["crud", "core:memo", "dependency"], bridge));
	const full = join(bridge, path), original = readFileSync(full, "utf8");
	const edit = editKbDocs(bridge,"test");
	edit.doc(idOf(dependency));
	updateKbDocField(edit, idOf(path), "gist", () => "depends on stale data");
	appendFileSync(join(bridge, dependency), "\nDependency changed\n");
	assert.throws(() => edit.commit(), isConflict);
	assert.equal(readFileSync(full, "utf8"), original);
});

test("a conflict in a later repository prevents writes and commits in every repository", async () => {
	const bridge = await tempBridge("edit-cross-repo-conflict");
	const path = ok(await run(["crud", "core:memo", "local"], bridge));
	const repo = checkedOut(bridge, "other");
	const remote = join(repo, "kb", `${WORKSPACE_DOC}.md`);
	writeFileSync(remote, `---\nkind: memo\nid: ${WORKSPACE_DOC}\nname: far\n---\n`);
	git(["add", "."], repo);git(["commit", "-qm", "remote document"], repo);
	const head = git(["rev-parse", "HEAD"], bridge), remoteHead = git(["rev-parse", "HEAD"], repo);
	const original = readFileSync(join(bridge, path), "utf8");
	const edit = editKbDocs(bridge,"test");
	updateKbDocField(edit, idOf(path), "gist", () => "local proposal");
	updateKbDocField(edit, WORKSPACE_DOC, "gist", () => "remote proposal");
	appendFileSync(remote, "\nExternal remote edit\n");
	assert.throws(() => edit.commit(), isConflict);
	assert.equal(readFileSync(join(bridge, path), "utf8"), original);
	assert.equal(git(["rev-parse", "HEAD"], bridge), head);
	assert.equal(git(["rev-parse", "HEAD"], repo), remoteHead);
});

test("refuses removed documents, index changes, new commits and touched source files", async (t) => {
	for (const action of ["remove", "index", "head", "touch"] as const) await t.test(action, async () => {
		const bridge = await tempBridge(`edit-${action}`);
		const path = ok(await run(["crud", "core:memo", "original"], bridge));
		const full = join(bridge, path), original = readFileSync(full, "utf8");
		const edit = editKbDocs(bridge,"test");
		updateKbDocField(edit, idOf(path), "gist", () => "proposal");
		if (action === "remove") rmSync(full);
		if (action === "index") git(["rm", "--cached", "--", path], bridge);
		if (action === "head") git(["commit", "--allow-empty", "-qm", "external commit"], bridge);
		if (action === "touch") { const later = new Date(Date.now() + 10000);utimesSync(full, later, later); }
		const head = git(["rev-parse", "HEAD"], bridge);
		assert.throws(() => edit.commit(), isConflict);
		if (action !== "remove") assert.equal(readFileSync(full, "utf8"), original);
		assert.equal(git(["rev-parse", "HEAD"], bridge), head);
	});
});

test("commits each repo's changed docs once, and skips a doc that ends unchanged", async () => {
	const bridge = await tempBridge("edit-docs");
	const a = ok(await run(["crud", "core:memo", "a"], bridge));
	const b = ok(await run(["crud", "core:memo", "b"], bridge));
	const c = ok(await run(["crud", "core:memo", "c"], bridge));
	const repo = checkedOut(bridge, "other");
	const inRepo = `kb/${WORKSPACE_DOC}.md`;
	writeFileSync(join(repo, inRepo), `---\nkind: memo\nid: ${WORKSPACE_DOC}\nname: far\n---\n`);
	git(["add", inRepo], repo);
	git(["commit", "-qm", "doc"], repo);
	const bridgeHead = git(["rev-parse", "HEAD"], bridge);

	const edit = editKbDocs(bridge, "test");
	assert.equal(edit.doc(idOf(a)), edit.doc(idOf(a)), "a doc is found once");
	updateKbDocField(edit, idOf(a), "gist", () => "first");
	updateKbDocField(edit, idOf(b), "gist", () => "second");
	updateKbDocField(edit, idOf(c), "gist", (gist) => gist);
	updateKbDocField(edit, WORKSPACE_DOC, "gist", () => "far away");
	assert.deepEqual(edit.commit().sort(), [a, b, c, `workspace/other/${inRepo}`].sort());

	assert.equal(git(["log", "--format=%s", `${bridgeHead}..HEAD`], bridge), "crud: edit");
	assert.equal(git(["show", "--name-only", "--format=", "HEAD"], bridge).split("\n").sort().join("\n"), [a, b].sort().join("\n"));
	assert.equal(git(["log", "-1", "--format=%s"], repo), "crud: edit");
	assert.match(readFileSync(join(repo, inRepo), "utf8"), /\ngist: far away\n/);
});

test("refuses a doc git does not track, before anything is written", async () => {
	const bridge = await tempBridge("edit-untracked");
	const path = join(kbOf(bridge), `${UNTRACKED}.md`);
	const text = `---\nkind: memo\nid: ${UNTRACKED}\nname: local\n---\n`;
	writeFileSync(path, text);
	appendFileSync(join(bridge, ".git", "info", "exclude"), `${kbPath(bridge, UNTRACKED)}\n`);
	assert.throws(() => editKbDocs(bridge, "test").doc(UNTRACKED), new RegExp(`${UNTRACKED} is not tracked by git in .+, so crud does not edit it`));

	const result = await run(["crud", UNTRACKED, "--gist", "changed"], bridge);
	assert.equal(result.code, 1);
	assert.match(result.err, /is not tracked by git/);
	assert.equal(readFileSync(path, "utf8"), text);
	ok(await run(["crud", UNTRACKED], bridge));
});

test("refuses outside a bridge and for a missing doc", async () => {
	assert.throws(() => editKbDocs(tempDir("edit-none"), "test"), /not in a bridge/);
	const bridge = await tempBridge("edit-missing");
	assert.throws(() => editKbDocs(bridge, "test").doc(UNTRACKED), new RegExp(`no doc ${UNTRACKED} in the bridge or its workspace`));
});

test("writes an edited doc in KINGSMETAL order, links last", async () => {
	const bridge = await tempBridge("edit-docs-order");
	const a = ok(await run(["crud", "core:memo", "a"], bridge));
	const path = join(bridge, a);
	const text = readFileSync(path, "utf8");
	const body = text.slice(text.indexOf("\n---\n") + 5);
	writeFileSync(path, `---\nlinks:\n  - kb/x.md:\n      rel: parent.feat\nextra: 1\nmeta:\n  z: 1\n  y: 2\ngist: a\nname: n\nid: ${idOf(a)}\nkind: memo\n---\n${body}`);
	git(["commit", "-qam", "misordered"], bridge);

	const edit = editKbDocs(bridge, "test");
	updateKbDocField(edit, idOf(a), "gist", () => "edited");
	edit.commit();

	const keys = readFileSync(path, "utf8").split("\n").filter((line) => /^[\w-]+:/.test(line)).map((line) => line.split(":")[0]);
	assert.deepEqual(keys, ["kind", "id", "name", "gist", "meta", "extra", "links"]);
	assert.match(readFileSync(path, "utf8"), /meta:\n {2}z: 1\n {2}y: 2\n/);
});

test("writes a doc whose only change is its key order", async () => {
	const bridge = await tempBridge("edit-docs-order-only");
	const a = ok(await run(["crud", "core:memo", "a"], bridge));
	const path = join(bridge, a);
	const text = readFileSync(path, "utf8");
	const body = text.slice(text.indexOf("\n---\n") + 5);
	writeFileSync(path, `---\nx-y: 1\nname: n\nid: ${idOf(a)}\nkind: memo\ngist: g\n---\n${body}`);
	git(["commit", "-qam", "misordered"], bridge);
	const before = git(["rev-parse", "HEAD"], bridge);

	const edit = editKbDocs(bridge, "test");
	updateKbDocField(edit, idOf(a), "gist", (gist) => gist);
	assert.deepEqual(edit.commit(), [a]);

	assert.notEqual(git(["rev-parse", "HEAD"], bridge), before);
	const keys = readFileSync(path, "utf8").split("\n").filter((line) => /^[\w-]+:/.test(line)).map((line) => line.split(":")[0]);
	assert.deepEqual(keys, ["kind", "id", "name", "gist", "x-y"]);
});

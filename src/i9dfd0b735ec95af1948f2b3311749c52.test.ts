// dock <ref>
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { i9dfd0b735ec95af1948f2b3311749c52 as dock, remoteKey } from "./i9dfd0b735ec95af1948f2b3311749c52.ts";
import { commitAll, dockHero, git } from "../test/harness.ts";

const head = (dir: string) => git(["rev-parse", "HEAD"], dir);
const detached = (dir: string) => assert.equal(git(["rev-parse", "--abbrev-ref", "HEAD"], dir), "HEAD");

test("docks a hero by its repo doc's quid under the docking hero's name, on a branch of its that pulls from and pushes to trunk", async () => {
	const { heroId, ids, origins, ctx, out, at, cache } = dockHero();
	await dock(ids.docked, undefined, ctx);
	assert.equal(git(["symbolic-ref", "--short", "HEAD"], at("docked")), `${heroId}/dock`);
	assert.equal(head(at("docked")), head(origins.docked));
	assert.equal(git(["rev-parse", "--abbrev-ref", "@{upstream}"], at("docked")), "origin/main");
	assert.equal(git(["config", "push.default"], cache(ids.docked)), "upstream");
	assert.equal(git(["rev-parse", "--is-bare-repository"], cache(ids.docked)), "true");
	assert.match(out.join("\n"), new RegExp(`docks[\\\\/]some-hero[\\\\/]docked: on ${heroId}/dock at \\w+\\nnosedive seed there builds its capes`));
});

test("matches a remote however it is spelled", () => {
	const key = remoteKey("https://github.com/KnowBoss/nosedive-dev.git");
	for (const spelling of ["git@github.com:KnowBoss/nosedive-dev.git", "git@GitHub.com:KnowBoss/nosedive-dev", "ssh://git@github.com/KnowBoss/nosedive-dev", "https://github.com/KnowBoss/nosedive-dev/"]) {
		assert.equal(remoteKey(spelling), key, spelling);
	}
	assert.notEqual(remoteKey("https://github.com/KnowBoss/nosedive"), key);
});

test("docks a hero by a remote its repo doc names, and by its repo doc's name, refusing what names none", async () => {
	const { origins, ctx, at } = dockHero();
	await dock(`${origins.docked}.git/`, undefined, ctx);
	assert.equal(head(at("docked")), head(origins.docked));
	await dock("plain", undefined, ctx);
	assert.equal(head(at("plain")), head(origins.plain));
	await assert.rejects(dock("https://example.com/nobody/nothing", undefined, ctx), /no repo doc or doc of the hero's is https:\/\/example\.com\/nobody\/nothing/);
});

test("refuses a ref that names more than one repo doc, naming them", async () => {
	const { hero, ids, ctx } = dockHero();
	const path = join(hero, `.nosedive/repos/${ids.plain}.md`);
	writeFileSync(path, readFileSync(path, "utf8").replace("name: plain", "name: docked"));
	await assert.rejects(dock("docked", undefined, ctx), /docked names 2 repo docs, docked and docked: dock one by its quid/);
});

test("docks a repo whose trunk holds no hero read-only, detached at its trunk", async () => {
	const { ids, origins, ctx, out, at } = dockHero("cape");
	await dock(ids.docked, undefined, ctx);
	detached(at("docked"));
	assert.equal(head(at("docked")), head(origins.docked));
	assert.match(out.join("\n"), /docks[\\/]some-hero[\\/]docked: detached at origin\/main \w+$/);
	assert.doesNotMatch(out.join("\n"), /nosedive seed/);
});

test("docks a feat's scopes read-only: one at its work branch, a hero at trunk, passing over a kind owner's entry", async () => {
	const { ids, origins, work, ctx, out, at } = dockHero();
	await dock(ids.feat, undefined, ctx);
	detached(at("plain"));
	assert.equal(head(at("plain")), work);
	detached(at("docked"));
	assert.equal(head(at("docked")), head(origins.docked));
	assert.match(out.join("\n"), /plain: detached at origin\/work\/plain \w+/);
	assert.match(out.join("\n"), /docked: detached at origin\/main \w+/);
});

test("docks a feat's work branch the remote lacks at trunk, and says so", async () => {
	const { ids, origins, ctx, out, at } = dockHero();
	git(["branch", "-q", "-D", "work/plain"], origins.plain);
	await dock(ids.feat, undefined, ctx);
	assert.equal(head(at("plain")), head(origins.plain));
	assert.match(out.join("\n"), /plain's remote has no branch work\/plain, so it is docked at main/);
});

test("refuses a feat with no repo in its scopes, or a scope naming no repo doc", async () => {
	const { hero, ids, ctx } = dockHero();
	const path = join(hero, `kb/${ids.feat}.md`);
	const text = readFileSync(path, "utf8");
	writeFileSync(path, text.replace(/scopes:[\s\S]*?(?=---)/, ""));
	await assert.rejects(dock(ids.feat, undefined, ctx), /feat some-feat has no scopes naming a repo/);
	writeFileSync(path, text.replace(`- ${ids.docked}: {}`, `- ${ids.feat}: {}`));
	await assert.rejects(dock(ids.feat, undefined, ctx), new RegExp(`feat some-feat scopes ${ids.feat}, which is no repo doc of the hero's`));
});

test("moves a read-only dock's detached HEAD when docked again", async () => {
	const { ids, origins, ctx, at } = dockHero();
	await dock("plain", undefined, ctx);
	const tip = commitAll(origins.plain, { "more.md": "more\n" });
	await dock("plain", undefined, ctx);
	detached(at("plain"));
	assert.equal(head(at("plain")), tip);
	await dock(ids.feat, undefined, ctx);
	assert.equal(git(["rev-parse", "HEAD"], at("plain")), git(["rev-parse", "work/plain"], origins.plain));
});

test("refuses to move a dirty read-only dock, naming its files, and for a feat moves none", async () => {
	const { ids, origins, ctx, at } = dockHero("cape");
	await dock(ids.feat, undefined, ctx);
	const docked = head(at("docked"));
	const plain = head(at("plain"));
	writeFileSync(join(at("plain"), "README.md"), "changed\n");
	writeFileSync(join(at("plain"), "stray.txt"), "stray\n");
	commitAll(origins.docked, { "more.md": "more\n" });
	await assert.rejects(dock(ids.feat, undefined, ctx), /plain has changed or untracked files, so it was not moved: README\.md, stray\.txt/);
	assert.equal(head(at("docked")), docked);
	assert.equal(head(at("plain")), plain);
});

test("refuses a dock of the other kind at the path", async () => {
	const { ids, ctx } = dockHero();
	await dock(ids.feat, undefined, ctx);
	await assert.rejects(dock(ids.docked, undefined, ctx), /docked is detached, not on \S+\/dock as a dock of a hero is: move it first/);
});

test("fast-forwards a hero dock already there, and refuses any other directory there", async () => {
	const { hero, ids, origins, ctx, at } = dockHero();
	await dock(ids.docked, undefined, ctx);
	const tip = commitAll(origins.docked, { "more.md": "more\n" });
	await dock(ids.docked, undefined, ctx);
	assert.equal(head(at("docked")), tip);

	mkdirSync(at("stray"), { recursive: true });
	const path = join(hero, `.nosedive/repos/${ids.docked}.md`);
	writeFileSync(path, readFileSync(path, "utf8").replace("name: docked", "name: stray"));
	await assert.rejects(dock(ids.docked, undefined, ctx), /docks[\\/]some-hero[\\/]stray is there already and is no dock of stray: move it first/);
	assert.equal(existsSync(join(dirname(at("stray")), "stray", ".git")), false);
});

test("docks to the same place from any branch of the docking hero, leaving the hero untouched", async () => {
	const { hero, heroId, ids, ctx, at } = dockHero();
	await dock(ids.docked, undefined, ctx);
	git(["checkout", "-q", "-b", "elsewhere"], hero);
	git(["checkout", "-q", "--detach"], hero);
	await dock(ids.docked, undefined, ctx);
	assert.equal(git(["symbolic-ref", "--short", "HEAD"], at("docked")), `${heroId}/dock`);
	assert.equal(git(["status", "--porcelain", "--ignored"], hero), "");
});

// dock <ref> --head <head>
import assert from "node:assert/strict";
import { test } from "node:test";
import { i0ac895fb79d75e2fb42b98f6d0bf3611 as dockAt } from "./i0ac895fb79d75e2fb42b98f6d0bf3611.ts";
import { commitAll, dockHero, git, ok, run } from "../test/harness.ts";

const head = (dir: string) => git(["rev-parse", "HEAD"], dir);
const detached = (dir: string) => assert.equal(git(["rev-parse", "--abbrev-ref", "HEAD"], dir), "HEAD");

test("docks a hero read-only at a branch of its remote", async () => {
	const { hero, origins, at } = dockHero();
	git(["checkout", "-q", "-b", "side"], origins.docked);
	const side = commitAll(origins.docked, { "side.md": "side\n" });
	const out = ok(await run(["dock", "docked", "--head", "side"], hero));
	detached(at("docked"));
	assert.equal(head(at("docked")), side);
	assert.match(out, /docked: detached at origin\/side \w+$/);
	assert.doesNotMatch(out, /nosedive seed/);
});

test("docks at a tag or commit the cache has, refusing a head it has not", async () => {
	const { origins, ctx, out, at } = dockHero();
	const first = head(origins.plain);
	git(["tag", "v1"], origins.plain);
	commitAll(origins.plain, { "more.md": "more\n" });
	await dockAt("plain", "v1", ctx);
	assert.equal(head(at("plain")), first);
	assert.match(out.join("\n"), /plain: detached at v1 \w+$/);
	await dockAt("plain", first.slice(0, 10), ctx);
	assert.equal(head(at("plain")), first);
	await assert.rejects(dockAt("plain", "nowhere", ctx), /plain has no nowhere to dock/);
	assert.equal(head(at("plain")), first);
});

test("docks every repo of a feat at the head", async () => {
	const { ids, origins, work, ctx, at } = dockHero();
	git(["checkout", "-q", "-b", "work/plain"], origins.docked);
	const docked = commitAll(origins.docked, { "side.md": "side\n" });
	await dockAt(ids.feat, "work/plain", ctx);
	assert.equal(head(at("plain")), work);
	assert.equal(head(at("docked")), docked);
	detached(at("docked"));
});

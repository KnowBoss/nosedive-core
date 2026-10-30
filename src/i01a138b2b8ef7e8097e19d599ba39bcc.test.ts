// check-meta
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { checkDocMeta, i01a138b2b8ef7e8097e19d599ba39bcc as checkMeta } from "./i01a138b2b8ef7e8097e19d599ba39bcc.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { kbOf, ok, run, tempBridge } from "../test/harness.ts";

const core: Cape = await sourceCape();
const OWNER = "01a18e62-0000-7000-8000-000000000001";
const closed = { type: "object", additionalProperties: false, properties: { owner: { type: "string" } } };
const cape = (kinds: Record<string, unknown>) => ({ ...core, owner: OWNER, name: "task-cape", shortName: "tasks", kinds }) as Cape;

test("checks against the acting repo's own kind, or a cape's by its spelling, and warns when none is declared", async () => {
	const dir = await tempBridge("check-meta");
	const capes = [core, cape({ task: { schema: closed } })];
	assert.equal(checkMeta("tasks:task", { owner: "dan" }, findBridge(dir)!, capes), undefined);
	assert.throws(() => checkMeta("tasks:task", { owner: 1, extra: true }, findBridge(dir)!, capes), /meta does not fit kind tasks:task:\n {2}meta must NOT have additional properties\n {2}\/owner must be string/);
	assert.match(checkMeta("task", {}, findBridge(dir)!, capes)!, /no kind task is declared here/, "a bare kind is not found among the capes'");
	ok(await run(["crud", "core:kind", "a task", "--name", "task", "--meta", "-"], dir, "schema:\n  type: object\n  additionalProperties: true\n"));
	assert.equal(checkMeta("task", { anything: 1 }, findBridge(dir)!, capes), undefined, "the hero's own open schema");
});

test("kind resolves refs and participates in normal schema composition", async () => {
	const dir = await tempBridge("check-meta-refs");
	const hero = findBridge(dir)!;
	const q = "01a17046-c550-7ef0-8503-6917ce9b65f2";
	writeFileSync(join(kbOf(dir), `${q}.md`), `---\nkind: question\nid: ${q}\n---\n`);
	const refs = cape({
		decision: {
			schema: {
				type: "object",
				required: ["question"],
				properties: {
					question: { type: "string", kind: "question" },
					optional: { anyOf: [{ type: "null" }, { type: "string", kind: "question" }] },
				},
			},
		},
	});
	const check = (meta: unknown, pending?: Map<string, { owner: string | undefined; name: string }>) => checkMeta("tasks:decision", meta, hero, [core, refs], pending);
	assert.equal(check({ question: q, optional: null }), undefined);
	assert.equal(check({ question: q, optional: q }), undefined);
	assert.equal(check({ question: q.toUpperCase() }), undefined, "a quid in capitals is read as the lowercase one");
	for (const value of ["../escape", "01a17046-c550-7ef0-8503-6917ce9b65f3", 42]) {
		assert.throws(() => check({ question: value }), /\/question/);
	}
	assert.throws(() => check({}), /required property 'question'/);
	assert.throws(() => check({ question: q }, new Map([[q, { owner: hero.id, name: "memo" }]])), /\/question must resolve/);
	writeFileSync(join(kbOf(dir), `${q}.md`), `---\nkind: memo\nid: ${q}\n---\n`);
	assert.throws(() => check({ question: q }), /\/question must resolve/);
	assert.equal(check({ question: q }, new Map([[q, { owner: hero.id, name: "question" }]])), undefined);
	const packaged = { ...refs, docs: { [q]: { kind: "question" } } } as unknown as Cape;
	assert.equal(checkMeta("tasks:decision", { question: "01a17046-c550-7ef0-8503-6917ce9b65f9" }, hero, [core, { ...packaged, docs: { "01a17046-c550-7ef0-8503-6917ce9b65f9": { kind: "question" } } } as unknown as Cape]), undefined);
});

test("a doc's own meta is checked against its kind, and each scope entry's against the root's kind as its key's owner declares it", async () => {
	const dir = await tempBridge("check-meta-doc");
	const hero = findBridge(dir)!;
	const capes = [core, cape({ task: { schema: closed } })];
	const doc = (meta: unknown, scopes: unknown[]) => ({ fm: { kind: "task", meta, scopes }, path: join(kbOf(dir), "01a18e62-0000-7000-8000-0000000000aa.md"), repoDir: dir });
	const named = { [OWNER]: { canonical: true } };
	assert.deepEqual(checkDocMeta(doc({ owner: "dan" }, [named]), hero, capes), []);
	assert.throws(() => checkDocMeta(doc({ owner: 1 }, [named]), hero, capes), /meta does not fit kind 01a18e62-0000-7000-8000-000000000001:task/);
	assert.deepEqual(checkDocMeta(doc({}, [named, { [hero.id!]: { meta: { x: 1 } } }]), hero, capes), [`no kind ${hero.id}:task is declared here; its meta is not checked`]);
	assert.throws(() => checkDocMeta(doc({}, [named, { [OWNER]: { meta: { owner: 2 } } }]), hero, capes), /scopes repeat the key/);
});

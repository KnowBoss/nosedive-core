// check-meta
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a138b2b8ef7e8097e19d599ba39bcc as checkMeta } from "./i01a138b2b8ef7e8097e19d599ba39bcc.ts";
import { tempDir } from "../test/harness.ts";

const closed = { type: "object", additionalProperties: false, properties: { owner: { type: "string" } } };
const cape = { kinds: { task: { schema: closed } } } as unknown as Cape;

test("checks against the first kb declaring the kind, then the capes, and warns when none does", () => {
	const kb = tempDir("check-meta");
	writeFileSync(join(kb, "k.md"), "---\nkind: kind\nname: task\nmeta:\n  schema:\n    type: object\n    additionalProperties: true\n---\n");
	assert.equal(checkMeta("task", { anything: 1 }, [kb], [cape]), undefined, "the kb's open schema wins");
	assert.equal(checkMeta("task", { owner: "dan" }, [], [cape]), undefined);
	assert.throws(() => checkMeta("task", { owner: 1, extra: true }, [], [cape]), /meta does not fit kind task:\n {2}meta must NOT have additional properties\n {2}\/owner must be string/);
	assert.match(checkMeta("note", {}, [kb], [cape])!, /no kind note is declared here/);
});

test("kind resolves refs and participates in normal schema composition", () => {
	const kb = tempDir("doc-kind");
	const q = "01a17046-c550-7ef0-8503-6917ce9b65f2";
	writeFileSync(join(kb, `${q}.md`), `---\nkind: question\nid: ${q}\n---\n`);
	const refs = { kinds: { decision: { schema: {
		type: "object", required: ["question"], properties: {
			question: { type: "string", kind: "question" },
			optional: { anyOf: [{ type: "null" }, { type: "string", kind: "question" }] },
		},
	} } }, docs: {} } as unknown as Cape;
	assert.equal(checkMeta("decision", { question: q, optional: null }, [kb], [refs]), undefined);
	assert.equal(checkMeta("decision", { question: q, optional: q }, [kb], [refs]), undefined);
	for (const value of ["../escape", "01a17046-c550-7ef0-8503-6917ce9b65f3", 42]) {
		assert.throws(() => checkMeta("decision", { question: value }, [kb], [refs]), /\/question/);
	}
	assert.throws(() => checkMeta("decision", {}, [kb], [refs]), /required property 'question'/);
	assert.throws(() => checkMeta("decision", { question: q }, [kb], [refs], undefined, new Map([[q, "memo"]])), /\/question must resolve/);
	writeFileSync(join(kb, `${q}.md`), `---\nkind: memo\nid: ${q}\n---\n`);
	assert.throws(() => checkMeta("decision", { question: q }, [kb], [refs]), /\/question must resolve/);
	assert.equal(checkMeta("decision", { question: q }, [kb], [refs], undefined, new Map([[q, "question"]])), undefined);
	const packaged = { ...refs, docs: { [q]: { kind: "question" } } } as unknown as Cape;
	assert.equal(checkMeta("decision", { question: q }, [], [packaged]), undefined);
});

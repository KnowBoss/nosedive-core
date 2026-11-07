// crud-gates
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { i01a133548178739398941123114401ad as usageId } from "./i01a133548178739398941123114401ad.ts";
import { i01a1336cb234701bb0338faf5183960c as codeSection } from "./i01a1336cb234701bb0338faf5183960c.ts";
import { changed } from "./i01a1b453a16c799bb9ce20fad1a9075b.ts";
import { CANONICAL, git, gitRepo, ok, registerRepo, run, setCapes, tempBridge } from "../test/harness.ts";

const ROOT = "01a1b455-0000-7000-8000-000000000001";
const NOTE = "01a1b455-0000-7000-8000-000000000002";
const BEFORE = "01a1b455-0000-7000-8000-000000000003";
const AFTER = "01a1b455-0000-7000-8000-000000000004";

/** A cape declaring the kind note, which links two crud gates: one refuses, one shapes. */
function noteCapeRepo(): string {
	const dir = gitRepo("note-cape");
	const gate = (id: string, name: string, text: string, code: string) => {
		const hex = id.replace(/-/g, "");
		const usage = { id: usageId(text, id), text };
		const doc = { kind: "action" as const, name, gist: name, usages: [usage], top: true, text: "", body: "" };
		return {
			[`kb/${id}.md`]: `---\nkind: action\nid: ${id}\nname: ${name}\ngist: "${name}"\nmeta:\n  usages:\n    - ${text}\n${CANONICAL}---\n${codeSection(`\n# ${name}\n`, doc, `i${hex}`)}`,
			[`src/i${hex}.ts`]: `import { i${usage.id} } from "./i${usage.id}.ts";\n\nexport function i${hex}(call: any) {\n\tif (call.usage === "u${usage.id}") return i${usage.id}(call.gate);\n}\n`,
			[`src/i${usage.id}.ts`]: `export function i${usage.id}(ctx: any) {\n${code}\n}\n`,
		};
	};
	const files: Record<string, string> = {
		".nosedive/config.yaml": `roots:\n  - kb/${ROOT}.md\n`,
		[`kb/${ROOT}.md`]: `---\nkind: cape\nid: ${ROOT}\nname: note-cape\n${CANONICAL}---\n`,
		[`.nosedive/kinds/${NOTE}.md`]: `---\nkind: kind\nid: ${NOTE}\nname: note\ngist: "A note"\nmeta:\n  schema:\n    type: object\nlinks:\n  - kb/${BEFORE}.md:\n      rel: crud.gate\n  - kb/${AFTER}.md:\n      rel: crud.gate\n---\n\n# Note\n\n## Drop when\n\nRead.\n`,
		...gate(BEFORE, "note-refuses", "before crud note", [
			'\tif (!ctx.after && ctx.before.fm.name === "kept") throw new Error("a kept note stays");',
			'\tif (ctx.after?.fm.gist === "refuse") throw new Error("asked to refuse");',
			'\tif (ctx.after?.fm.gist === "write") ctx.crud(ctx.doc.id, "gist", "written before");',
		].join("\n")),
		...gate(AFTER, "note-shapes", "after crud note", [
			'\tif (ctx.after?.fm.gist === "boom") throw new Error("boom");',
			'\tif (!ctx.before) ctx.crud(ctx.doc.id, "section", { heading: "Minted", text: "by the gate" });',
			'\telse if (ctx.before.fm.gist !== ctx.after.fm.gist) ctx.crud(ctx.doc.id, "section", { heading: "Gist was", text: String(ctx.before.fm.gist) });',
		].join("\n")),
	};
	for (const [file, text] of Object.entries(files)) {
		mkdirSync(join(dir, dirname(file)), { recursive: true });
		writeFileSync(join(dir, file), text);
	}
	git(["add", "-A"], dir);
	git(["commit", "-qm", "note cape"], dir);
	return dir;
}

async function noteBridge(label: string): Promise<string> {
	const bridge = await tempBridge(label);
	await registerRepo(bridge, "note-cape", noteCapeRepo());
	setCapes(bridge, ["note-cape"]);
	ok(await run(["seed"], bridge));
	return bridge;
}

const head = (bridge: string) => git(["rev-parse", "HEAD"], bridge);

test("an after gate shapes a doc as it is minted, and on an edit sees it as it was, all in crud's one commit", async () => {
	const bridge = await noteBridge("crud-gates-after");
	const path = ok(await run(["crud", "note-cape:note", "a", "note", "--name", "first"], bridge));
	assert.match(readFileSync(join(bridge, path), "utf8"), /\n## Minted\n\nby the gate\n/);
	assert.equal(git(["status", "--porcelain", "--", path], bridge), "", "minted and shaped in one commit");
	const id = path.replace(/^.*\/|\.md$/g, "");
	const before = head(bridge);
	ok(await run(["crud", id, "--gist", "renamed"], bridge));
	assert.match(readFileSync(join(bridge, path), "utf8"), /^gist: "renamed"$[^]*\n## Gist was\n\na note\n/m);
	assert.equal(git(["rev-list", "--count", `${before}..HEAD`], bridge), "1");
});

test("a before gate refuses an edit or a drop and nothing is written; it cannot edit", async () => {
	const bridge = await noteBridge("crud-gates-before");
	const path = ok(await run(["crud", "note-cape:note", "kept", "--name", "kept"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	const text = readFileSync(join(bridge, path), "utf8");
	const at = head(bridge);
	const refused = await run(["crud", id, "--gist", "refuse"], bridge);
	assert.match(refused.err, /crud gate note-refuses refused, so nothing was written: asked to refuse/);
	const writing = await run(["crud", id, "--gist", "write"], bridge);
	assert.match(writing.err, /a before gate only refuses/);
	const dropped = await run(["crud", "--drop", id], bridge);
	assert.match(dropped.err, /a kept note stays/);
	assert.equal(readFileSync(join(bridge, path), "utf8"), text);
	assert.equal(head(bridge), at);
});

test("an after gate that fails on a mint takes the minted doc out again", async () => {
	const bridge = await noteBridge("crud-gates-boom");
	const status = git(["status", "--porcelain"], bridge);
	const at = head(bridge);
	const failed = await run(["crud", "note-cape:note", "boom"], bridge);
	assert.match(failed.err, /crud gate note-shapes failed, so nothing was written: boom/);
	assert.equal(git(["status", "--porcelain"], bridge), status);
	assert.equal(head(bridge), at);
});

test("a doc of a kind with no crud gates is minted as before", async () => {
	const bridge = await noteBridge("crud-gates-none");
	const path = ok(await run(["crud", "core:memo", "plain"], bridge));
	assert.ok(existsSync(join(bridge, path)));
	assert.match(git(["log", "-1", "--format=%s"], bridge), /^crud: core:memo$/);
});

test("changed compares a dotted path of the frontmatter, a missing state having nothing there", () => {
	const doc = (feat?: string) => ({ fm: { meta: feat ? { feat } : {} }, body: "" });
	assert.equal(changed(doc("a"), doc("a"), "meta.feat"), false);
	assert.equal(changed(doc("a"), doc("b"), "meta.feat"), true);
	assert.equal(changed(undefined, doc("a"), "meta.feat"), true);
	assert.equal(changed(undefined, doc(), "meta.feat"), false);
});

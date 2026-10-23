// crud-edit
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a14ab1d36771eea2bc6f13bdeb0526 as editKbDocs } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a14b30ecc07ea18999d6255d636e39 as crudEdit } from "./i01a14b30ecc07ea18999d6255d636e39.ts";
import { ok, run, tempBridge } from "../test/harness.ts";

test("applies an edit named as its flag, with its value inline, and refuses an unknown one or a bad quid", async () => {
	const bridge = await tempBridge("crud-edit");
	const path = ok(await run(["crud", "goal", "a"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	const ctx = { cwd: bridge, capes: [], out: () => {}, err: () => {} } as unknown as Ctx;

	const edit = editKbDocs(bridge);
	crudEdit(edit, id.toUpperCase(), "gist", "changed", ctx);
	crudEdit(edit, id, "section", { heading: "Open", text: "Nothing." }, ctx);
	assert.throws(() => crudEdit(edit, id, "size", 2, ctx), /no crud edit size: the edits are meta, scopes, links, parent, title, body, section, replace, gist, name, kind/);
	assert.throws(() => crudEdit(edit, "nope", "gist", "x", ctx), /quid is not a quid: nope/);
	assert.throws(() => crudEdit(edit, id, "gist", 3, ctx), /gist takes text/);
	edit.commit();
	const text = readFileSync(join(bridge, path), "utf8");
	assert.match(text, /\ngist: "?changed"?\n/);
	assert.match(text, /## Open\n\nNothing\.\n$/);
});

// drop-when
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1a7181a447bbb991c9a0f584f2549 as dropWhen } from "./i01a1a7181a447bbb991c9a0f584f2549.ts";
import { dropWhenOf } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { CANONICAL, gitRepo } from "../test/harness.ts";

const core: Cape = await sourceCape();
const ROOT = "01a1a718-0000-7000-8000-000000000001";
const id = (n: number) => `01a1a718-0000-7000-8000-${String(n).padStart(12, "0")}`;

function repo(label: string) {
	const dir = gitRepo(label);
	mkdirSync(join(dir, ".nosedive", "kinds"), { recursive: true });
	mkdirSync(join(dir, "kb"));
	writeFileSync(join(dir, "kb", `${ROOT}.md`), `---\nkind: base\nid: ${ROOT}\n${CANONICAL}---\n\n# Root\n`);
	writeFileSync(join(dir, ".nosedive", "config.yaml"), `id: ${ROOT}\nroots:\n  - kb/${ROOT}.md\n`);
	return dir;
}

function kindDoc(dir: string, n: number, name: string, body: string, where = ".nosedive/kinds"): string {
	const path = join(dir, where, `${id(n)}.md`);
	writeFileSync(path, `---\nkind: kind\nid: ${id(n)}\nname: ${name}\nmeta:\n  schema:\n    type: object\n---\n\n# ${name}\n\nWhat it is.\n${body}`);
	return path;
}

const quiet = () => {
	const said: string[] = [];
	return { said, ctx: { capes: [core], out: (line: string) => said.push(line) } };
};

test("renames each kind doc's Done when to Drop when, text and durability kept, and leaves the rest alone", () => {
	const dir = repo("drop-when");
	const step = kindDoc(dir, 2, "step", "\n## Done when\n\nIt is landed.\n\n## Notes\n\nKept.\n");
	const keep = kindDoc(dir, 3, "keep", "");
	const lower = kindDoc(dir, 4, "idea", "\n## done when\n\nIt is acted on.\n");
	const already = kindDoc(dir, 5, "goal", "\n## Drop when\n\nIt is met.\n");
	const keepText = readFileSync(keep, "utf8");
	const alreadyText = readFileSync(already, "utf8");
	const { said, ctx } = quiet();
	assert.deepEqual(new Set(dropWhen(dir, ctx)), new Set([step, lower]));
	assert.match(readFileSync(step, "utf8"), /\n## Drop when\n\nIt is landed\.\n\n## Notes\n\nKept\.\n$/);
	assert.equal(dropWhenOf(readFileSync(step, "utf8").split("---\n")[2]!), "It is landed.", "as droppable as before");
	assert.match(readFileSync(lower, "utf8"), /\n## Drop when\n\nIt is acted on\.\n$/, "its heading read in any case");
	assert.equal(readFileSync(keep, "utf8"), keepText, "a durable kind has nothing to rename");
	assert.equal(readFileSync(already, "utf8"), alreadyText);
	assert.ok(said.some((line) => /kind step's Done when is now its Drop when: reword it/.test(line)));
	assert.deepEqual(dropWhen(dir, quiet().ctx), [], "safe to run again");
});

test("waits, writing nothing, while a kind doc has both headings", () => {
	const dir = repo("drop-when-both");
	const both = kindDoc(dir, 2, "step", "\n## Done when\n\nOld.\n\n## Drop when\n\nNew.\n");
	const before = readFileSync(both, "utf8");
	const { said, ctx } = quiet();
	assert.equal(dropWhen(dir, ctx), undefined);
	assert.equal(readFileSync(both, "utf8"), before);
	assert.match(said.join("\n"), /kind step .* has both a Done when and a Drop when section; keep one, then seed/);
});

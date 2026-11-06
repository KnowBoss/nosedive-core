// run-cape-migrations
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parseDocument } from "yaml";
import { i01a1336cb234701bb0338faf5183960c as codeSection } from "./i01a1336cb234701bb0338faf5183960c.ts";
import { CANONICAL, git, greetCapeRepo, ok, registerRepo, run, setCapes, tempBridge } from "../test/harness.ts";

const FIRST = "01a1b30e-0000-7000-8000-000000000001";
const SECOND = "01a1b30e-0000-7000-8000-000000000002";

/** greet-cape with two migrations: the first writes marked.txt, appending a line each run; the second, after it, waits while waiting.txt exists. */
function migratingCape(): string {
	const dir = greetCapeRepo();
	const migration = (id: string, name: string, after: string | undefined, code: string) => {
		const hex = `i${id.replace(/-/g, "")}`;
		const doc = { kind: "function" as const, name, gist: name, usages: [], top: true, text: "", body: "" };
		writeFileSync(join(dir, "kb", `${id}.md`), `---\nkind: migration\nid: ${id}\nname: ${name}\ngist: "${name}"\n${after ? `meta:\n  after: ${after}\n` : ""}${CANONICAL}---\n${codeSection(`\n# ${name}\n\nWhat ${name} does.\n`, doc, hex)}`);
		writeFileSync(join(dir, "src", `${hex}.ts`), `import { appendFileSync, existsSync } from "node:fs";\nimport { join } from "node:path";\n\nexport function ${hex}(dir: string, ctx: { out(text: string): void }): string[] | undefined {\n${code}\n}\n`);
		writeFileSync(join(dir, "src", `${hex}.test.ts`), `import { test } from "node:test";\n\ntest("${name}", () => {});\n`);
	};
	migration(FIRST, "mark", undefined, '\tappendFileSync(join(dir, "marked.txt"), "marked\\n");\n\tctx.out("mark: marked");\n\treturn [join(dir, "marked.txt")];');
	migration(SECOND, "after-mark", FIRST, '\tif (existsSync(join(dir, "waiting.txt"))) return undefined;\n\treturn [];');
	git(["add", "-A"], dir);
	git(["commit", "-qm", "migrations"], dir);
	return dir;
}

const listed = (bridge: string) => (parseDocument(readFileSync(join(bridge, ".nosedive", "config.yaml"), "utf8")).toJS() as { migrations: string[] }).migrations;

test("seed runs a worn cape's migrations after building it, in chain order, each listed as <cape repo id>:<migration id> in its own commit", async () => {
	const bridge = await tempBridge("cape-migrations");
	const repo = await registerRepo(bridge, "greet-cape", migratingCape());
	setCapes(bridge, ["greet-cape"]);
	git(["add", "-A"], bridge);
	git(["commit", "-qm", "wear greet-cape"], bridge);

	const said = ok(await run(["seed"], bridge));
	assert.match(said, /^built cape greet-cape [^]*^mark: marked\nmigrated [^\n]+: greet-cape:mark$/m);
	assert.deepEqual(listed(bridge).slice(-2), [`${repo}:${FIRST}`, `${repo}:${SECOND}`]);
	const subjects = git(["log", "--format=%s"], bridge).split("\n").filter((subject) => subject.startsWith("migrate: greet-cape:"));
	assert.deepEqual(subjects, ["migrate: greet-cape:after-mark", "migrate: greet-cape:mark"]);
	assert.equal(readFileSync(join(bridge, "marked.txt"), "utf8"), "marked\n");

	ok(await run(["seed"], bridge));
	assert.equal(readFileSync(join(bridge, "marked.txt"), "utf8"), "marked\n", "a listed migration does not run again");

	const config = join(bridge, ".nosedive", "config.yaml");
	writeFileSync(config, readFileSync(config, "utf8").replace(`  - ${repo}:${FIRST}\n`, ""));
	git(["commit", "-qam", "run mark again"], bridge);
	ok(await run(["seed"], bridge));
	assert.equal(readFileSync(join(bridge, "marked.txt"), "utf8"), "marked\nmarked\n", "removing its entry runs it again");
	assert.ok(listed(bridge).includes(`${repo}:${FIRST}`));
});

test("a cape migration that waits holds back the cape's later ones, unrecorded, and core passes over a cape's entries", async () => {
	const bridge = await tempBridge("cape-migrations-wait");
	const repo = await registerRepo(bridge, "greet-cape", migratingCape());
	setCapes(bridge, ["greet-cape"]);
	writeFileSync(join(bridge, "waiting.txt"), "wait\n");
	git(["add", "-A"], bridge);
	git(["commit", "-qm", "wear greet-cape, waiting"], bridge);
	ok(await run(["seed"], bridge));
	assert.ok(listed(bridge).includes(`${repo}:${FIRST}`));
	assert.equal(listed(bridge).includes(`${repo}:${SECOND}`), false);
	git(["rm", "-q", "waiting.txt"], bridge);
	git(["commit", "-qm", "stop waiting"], bridge);
	ok(await run(["seed"], bridge));
	assert.ok(listed(bridge).includes(`${repo}:${SECOND}`));
	assert.equal(existsSync(join(bridge, "waiting.txt")), false);
});

test("crud reads a worn cape's migration doc by its id", async () => {
	const bridge = await tempBridge("cape-migrations-crud");
	await registerRepo(bridge, "greet-cape", migratingCape());
	setCapes(bridge, ["greet-cape"]);
	git(["add", "-A"], bridge);
	git(["commit", "-qm", "wear greet-cape"], bridge);
	ok(await run(["seed"], bridge));
	assert.match(ok(await run(["crud", FIRST], bridge)), /^---\nkind: migration\nid: 01a1b30e-0000-7000-8000-000000000001\nname: mark\n[^]*What mark does\./);
});

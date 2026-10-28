import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { i01a133548178739398941123114401ad as usageId } from "../src/i01a133548178739398941123114401ad.ts";
import { i01a1336cb234701bb0338faf5183960c as codeSection } from "../src/i01a1336cb234701bb0338faf5183960c.ts";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "../src/i01a1335480c776ba8945020d0af333eb.ts";
import { after } from "node:test";
import { i01a1336a958f71c7beec4db3195c7966 as launch, type Cape, type Ctx } from "../src/i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "../src/i01a13dee4b1d78f7a699c3777bf63587.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";

const cape: Cape = await sourceCape();

export type Run = { code: number; out: string; err: string };

/** Runs one command line in-process against this repo's source cape. */
export async function run(argv: string[], cwd: string, stdin = ""): Promise<Run> {
	const out: string[] = [];
	const err: string[] = [];
	const ctx: Ctx = {
		cwd,
		capes: [cape],
		out: (text) => out.push(text),
		err: (text) => err.push(text),
		stdin: async () => stdin,
	};
	const code = await launch(argv, ctx);
	return { code, out: out.join("\n"), err: err.join("\n") };
}

export function ok(result: Run): string {
	assert.equal(result.code, 0, result.err);
	return result.out;
}

export function tempDir(label: string): string {
	const dir = mkdtempSync(join(tmpdir(), `nosedive-core-${label}-`));
	after(() => rmSync(dir, { recursive: true, force: true }));
	return dir;
}

// Repo caches are the user's; a test's go in a user dir of its own.
process.env.NOSEDIVE_USER_DIR = tempDir("user");

export function git(args: string[], cwd: string): string {
	const result = spawnSync("git", args, { cwd, encoding: "utf8" });
	assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
	return result.stdout.trim();
}

export function gitRepo(label: string): string {
	const dir = tempDir(label);
	git(["init", "-q", "-b", "main"], dir);
	git(["config", "user.name", "Core Test"], dir);
	git(["config", "user.email", "core@example.com"], dir);
	return dir;
}

export const GREET = "01a1337c-830d-7ef7-b5b2-ab0bc3a666e9";
const NAMESPACED_UUID = "01a13354-8014-7d06-8652-8aee80f8ee34";

export const CAPE_TESTS_PASS = "01a138b2-b8f3-7d32-82d2-274fae0f5007";

type Fixture = { gated?: boolean; plain?: boolean; legacy?: boolean; name?: string };

/** Makes a repo a cape by a cape root its config lists, or an older config's root when legacy, linking core's cape-tests-pass when gated. */
function asCape(name: string, files: Record<string, string>, options: Fixture): void {
	if (options.plain) return;
	const root = mintUuid();
	const gate = options.gated ? `links:\n  - nosedive-core:${CAPE_TESTS_PASS}:\n      rel: test.gate\n` : "";
	const doc = `---\nkind: cape\nid: ${root}\nname: ${name}\n${gate}---\n`;
	if (options.legacy) {
		files[".nosedive/config.yaml"] = `kb: ./kb\nroot: ${root}\n`;
		files[`kb/${root}.md`] = doc;
	} else {
		files[".nosedive/config.yaml"] = `id: ${mintUuid()}\nroots:\n  - kb/${root}.md\n`;
		files[`kb/${root}.md`] = doc;
	}
}

/**
 * A committed cape repo with one action, `greet <who>`, whose impl imports core's namespaced-uuid.
 * `link: false` leaves that import unlinked; `importing` swaps the imported core doc. `gated`
 * links core's test gate from its root; `plain` makes it no bridge at all; `failing` fails its test; `name` names its root.
 */
export function greetCapeRepo(options: Fixture & { link?: boolean; importing?: string; failing?: boolean } = {}): string {
	const dir = gitRepo("greet-cape");
	const imported = (options.importing ?? NAMESPACED_UUID).replace(/-/g, "");
	const usage = usageId("greet <who>", GREET);
	const hex = GREET.replace(/-/g, "");
	const links = options.link === false ? "" : `links:\n  - nosedive-core:${options.importing ?? NAMESPACED_UUID}:\n      rel: uses.action\n`;
	const doc = { kind: "action" as const, name: "greet", gist: "Greets", usages: [{ id: usage, text: "greet <who>" }], top: true, text: "", body: "" };
	const files: Record<string, string> = {
		[`kb/${GREET}.md`]: `---\nkind: action\nid: ${GREET}\nname: greet\ngist: "Greets"\nmeta:\n  usages:\n    - greet <who>\n${links}---\n${codeSection("\n# Greet\n", doc, `i${hex}`)}`,
		[`src/i${hex}.ts`]: `import type { ActionCall } from "nosedive-core";\nimport { i${usage} } from "./i${usage}.ts";\n\nexport async function i${hex}(call: ActionCall) {\n\tif (call.usage === "u${usage}") return i${usage}(String(call.args.who), call.ctx);\n}\n`,
		[`src/i${usage}.ts`]: `import { i${imported} as namespacedUuid } from "nosedive-core";\n\nexport async function i${usage}(who: string, ctx: { out(text: string): void }) {\n\tctx.out(\`hello \${who} \${namespacedUuid(who, "${GREET}")}\`);\n}\n`,
		[`src/i${usage}.test.ts`]: [
			'import assert from "node:assert/strict";',
			'import { test } from "node:test";',
			`import { i${usage} } from "./i${usage}.ts";`,
			"",
			'test("greet <who>", async () => {',
			"\tconst out: string[] = [];",
			`\tawait i${usage}("ann", { out: (text) => void out.push(text) });`,
			`\tassert.equal(out[0]!.slice(0, 10), ${JSON.stringify(options.failing ? "goodbye an" : "hello ann ")});`,
			"});",
			"",
		].join("\n"),
	};
	asCape(options.name ?? "greet-cape", files, options);
	for (const [file, text] of Object.entries(files)) {
		mkdirSync(join(dir, dirname(file)), { recursive: true });
		writeFileSync(join(dir, file), text);
	}
	git(["add", "-A"], dir);
	git(["commit", "-qm", "greet cape"], dir);
	return dir;
}

export const WAVE = "01a13565-da1a-740c-82a8-179828018344";

/**
 * A committed cape repo with one action, `wave <who>`, which runs greet-cape's greet, imported by id, then waves.
 * `gated` links core's test gate from its root.
 */
export function waveCapeRepo(options: Fixture = {}): string {
	const dir = gitRepo("wave-cape");
	const usage = usageId("wave <who>", WAVE);
	const greetUsage = usageId("greet <who>", GREET);
	const hex = WAVE.replace(/-/g, "");
	const greet = `i${GREET.replace(/-/g, "")}`;
	const doc = { kind: "action" as const, name: "wave", gist: "Waves", usages: [{ id: usage, text: "wave <who>" }], top: true, text: "", body: "" };
	const files: Record<string, string> = {
		[`kb/${WAVE}.md`]: `---\nkind: action\nid: ${WAVE}\nname: wave\ngist: "Waves"\nmeta:\n  usages:\n    - wave <who>\nlinks:\n  - greet-cape:${GREET}:\n      rel: uses.action\n---\n${codeSection("\n# Wave\n", doc, `i${hex}`)}`,
		[`src/i${hex}.ts`]: `import type { ActionCall } from "nosedive-core";\nimport { i${usage} } from "./i${usage}.ts";\n\nexport async function i${hex}(call: ActionCall) {\n\tif (call.usage === "u${usage}") return i${usage}(call);\n}\n`,
		[`src/i${usage}.ts`]: `import type { ActionCall } from "nosedive-core";\nimport { ${greet} as greet } from "greet-cape";\n\nexport async function i${usage}(call: ActionCall) {\n\tawait greet({ ...call, usage: "u${greetUsage}" });\n\tcall.ctx.out("and waves");\n}\n`,
		[`src/i${usage}.test.ts`]: [
			'import assert from "node:assert/strict";',
			'import { test } from "node:test";',
			`import { i${usage} } from "./i${usage}.ts";`,
			"",
			'test("wave <who>", async () => {',
			"\tconst out: string[] = [];",
			`\tawait i${usage}({ usage: "u${usage}", args: { who: "bo" }, ctx: { out: (text: string) => void out.push(text) } } as never);`,
			'\tassert.equal(out.join("|").replace(/[0-9a-f-]{36}/, "id"), "hello bo id|and waves");',
			"});",
			"",
		].join("\n"),
	};
	asCape(options.name ?? "wave-cape", files, options);
	for (const [file, text] of Object.entries(files)) {
		mkdirSync(join(dir, dirname(file)), { recursive: true });
		writeFileSync(join(dir, file), text);
	}
	git(["add", "-A"], dir);
	git(["commit", "-qm", "wave cape"], dir);
	return dir;
}

/** The directory a repo keeps its docs in, as its config names it: a hero's bridge, any other repo's kb. */
export function kbOf(dir: string): string {
	return readRepoConfig(dir)?.kbDir ?? join(dir, "kb");
}

/** Registers a repo doc named `name` in a bridge, cloned from `path` when given; returns its id. */
export async function registerRepo(bridge: string, name: string, path?: string): Promise<string> {
	const id = mintUuid();
	const meta = path === undefined ? "" : `meta:\n  remotes:\n    origin: ${JSON.stringify(path)}\n`;
	writeFileSync(join(kbOf(bridge), `${id}.md`), `---\nkind: repo\nid: ${id}\nname: ${name}\n${meta}---\n`);
	return id;
}

/** Lists `capes` in a bridge's config, each as `<repo>` or `<repo>@<ref>`. */
export function setCapes(bridge: string, capes: string[]): void {
	const config = join(bridge, ".nosedive", "config.yaml");
	const kept = (existsSync(config) ? readFileSync(config, "utf8") : "\n").replace(/\ncapes:\n( {2}.*\n)*/, "\n");
	writeFileSync(config, `${kept}capes:\n${capes.map((spec) => `  - ${spec}\n`).join("")}`);
}

/** A git repo with an empty kb, checked out at `workspace/<name>` in a bridge. */
export function checkedOut(bridge: string, name: string): string {
	const dir = join(bridge, "workspace", name);
	mkdirSync(join(dir, "kb"), { recursive: true });
	git(["init", "-q", "-b", "main"], dir);
	git(["config", "user.name", "Core Test"], dir);
	git(["config", "user.email", "core@example.com"], dir);
	git(["commit", "-q", "--allow-empty", "-m", "start"], dir);
	return dir;
}

/** A hero repo, seeded in a fresh temp repo: the repo a team works from, with a workspace. */
export async function tempBridge(label: string, seed: string[] = []): Promise<string> {
	const dir = gitRepo(label);
	ok(await run(["seed", "--workspace", ...seed], dir));
	return dir;
}

/** A package of one CommonJS module, which requires a node builtin, for a repo to depend on by path. */
export function shoutPackage(dir: string): void {
	mkdirSync(join(dir, "vendor", "shout"), { recursive: true });
	writeFileSync(join(dir, "vendor", "shout", "package.json"), JSON.stringify({ name: "shout", version: "1.0.0", main: "index.js" }));
	writeFileSync(join(dir, "vendor", "shout", "index.js"), 'const { EOL } = require("node:os");\nmodule.exports = (text) => text.toUpperCase() + (EOL ? "!" : "?");\n');
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "with-shout", private: true, dependencies: { shout: "file:vendor/shout" } }));
}

export function lock(dir: string): void {
	const npm = spawnSync("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: dir, encoding: "utf8", shell: process.platform === "win32" });
	assert.equal(npm.status, 0, npm.stderr);
}

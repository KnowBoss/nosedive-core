import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { parseDocument } from "yaml";
import { i01a133548178739398941123114401ad as usageId } from "../src/i01a133548178739398941123114401ad.ts";
import { i01a1336cb234701bb0338faf5183960c as codeSection } from "../src/i01a1336cb234701bb0338faf5183960c.ts";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "../src/i01a1335480c776ba8945020d0af333eb.ts";
import { after } from "node:test";
import { i01a1336a958f71c7beec4db3195c7966 as launch, type Cape, type Ctx } from "../src/i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "../src/i01a13dee4b1d78f7a699c3777bf63587.ts";
import { cachePath } from "../src/i01a15baf13e27bd88dc880d4871f2210.ts";
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

/** Core's seeded id, which a cape's docs name in a canonical scope to be core's kinds. */
export const CORE = "01a1336b-c0b8-7cde-b7c6-285196062297";
export const CANONICAL = `scopes:\n  - ${CORE}:\n      canonical: true\n`;

export const GREET ="01a1337c-830d-7ef7-b5b2-ab0bc3a666e9";
const NAMESPACED_UUID = "01a13354-8014-7d06-8652-8aee80f8ee34";

export const CAPE_TESTS_PASS = "01a138b2-b8f3-7d32-82d2-274fae0f5007";

type Fixture = { gated?: boolean; plain?: boolean; name?: string };

/** Makes a repo a cape by a cape root its config lists, linking core's cape-tests-pass when gated. */
function asCape(name: string, files: Record<string, string>, options: Fixture): void {
	if (options.plain) return;
	const root = mintUuid();
	const gate = options.gated ? `links:\n  - nosedive-core:${CAPE_TESTS_PASS}:\n      rel: test.gate\n` : "";
	const doc = `---\nkind: cape\nid: ${root}\nname: ${name}\n${CANONICAL}${gate}---\n`;
	files[".nosedive/config.yaml"] = `id: ${mintUuid()}\nroots:\n  - kb/${root}.md\n`;
	files[`kb/${root}.md`] = doc;
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
		[`kb/${GREET}.md`]: `---\nkind: action\nid: ${GREET}\nname: greet\ngist: "Greets"\nmeta:\n  usages:\n    - greet <who>\n${CANONICAL}${links}---\n${codeSection("\n# Greet\n", doc, `i${hex}`)}`,
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
		[`kb/${WAVE}.md`]: `---\nkind: action\nid: ${WAVE}\nname: wave\ngist: "Waves"\nmeta:\n  usages:\n    - wave <who>\n${CANONICAL}links:\n  - greet-cape:${GREET}:\n      rel: uses.action\n---\n${codeSection("\n# Wave\n", doc, `i${hex}`)}`,
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

/** The primary root's directory, as the repo config names it. */
export function kbOf(dir: string): string {
	return readRepoConfig(dir)?.kbDir ?? join(dir, "kb");
}

/** A doc's repo-relative path under the configured primary root. */
export function kbPath(dir: string, id: string): string {
	return relative(dir, join(kbOf(dir), `${id}.md`)).replace(/\\/g, "/");
}

/** Registers a repo doc named `name` in a bridge, cloned from `path` when given; returns its id. */
export async function registerRepo(bridge: string, name: string, path?: string): Promise<string> {
	const id = mintUuid();
	const meta = path === undefined ? "" : `meta:\n  remotes:\n    origin: ${JSON.stringify(path)}\n`;
	mkdirSync(join(bridge, ".nosedive", "repos"), { recursive: true });
	writeFileSync(join(bridge, ".nosedive", "repos", `${id}.md`), `---\nkind: repo\nid: ${id}\nname: ${name}\n${meta}---\n`);
	return id;
}

/** Has a bridge's primary root wear exactly `capes`, each `<repo>` or `<repo>@<ref>` by its registered name, as .cape links. */
export function setCapes(bridge: string, capes: string[]): void {
	const config = readRepoConfig(bridge)!;
	const path = config.roots.find((root) => root.id === config.root)!.path;
	const [, fm, body] = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(readFileSync(path, "utf8"))!;
	const doc = parseDocument(fm!);
	const isCape = (link: Record<string, { rel?: unknown } | null>) => Object.values(link).some((value) => typeof value?.rel === "string" && value.rel.split(".").at(-1) === "cape");
	const links = ((doc.toJS() as { links?: Record<string, { rel?: unknown } | null>[] }).links ?? []).filter((link) => !isCape(link));
	const dirs = [join(bridge, ".nosedive", "repos"), kbOf(bridge)].filter((dir) => existsSync(dir));
	for (const spec of capes) {
		const [name, ref] = spec.split("@", 2) as [string, string | undefined];
		const file = dirs.flatMap((dir) => readdirSync(dir).map((each) => join(dir, each))).find((each) => each.endsWith(".md") && new RegExp(`^kind: repo$[^]*^name: ${name}$`, "m").test(readFileSync(each, "utf8")));
		if (!file) throw new Error(`setCapes: no repo named ${name} is registered in ${bridge}`);
		links.push({ [relative(bridge, file).replace(/\\/g, "/")]: { rel: ".cape", ...(ref ? { ref } : {}) } as { rel: string } });
	}
	if (links.length > 0) doc.set("links", links);
	else doc.delete("links");
	writeFileSync(path, `---\n${doc.toString({ lineWidth: 0 })}---\n${body}`);
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

/** A hero seeded as a user seeds one, left exactly as seed made it. */
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

/** Declares open kinds in a hero, as its own, so crud can write docs of them: passing work, each saying when one of it is done. */
export async function declareKinds(hero: string, ...names: string[]): Promise<void> {
	for (const name of names) {
		const path = ok(await run(["crud", "core:kind", `a ${name}`, "--name", name, "--meta", "-"], hero, "schema:\n  type: object\n  additionalProperties: true\n"));
		ok(await run(["crud", path.replace(/^.*\/|\.md$/g, ""), "--section", "Drop when", "-"], hero, `A ${name} is dropped once it is done.\n`));
	}
}

/** Declares an open, durable kind in a hero, as its own: its doc has no Drop when. */
export async function declareDurable(hero: string, name: string): Promise<void> {
	ok(await run(["crud", "core:kind", `a ${name}`, "--name", name, "--meta", "-"], hero, "schema:\n  type: object\n  additionalProperties: true\n"));
}

/** Commits files to a repo, as they are given; returns the commit. */
export function commitAll(dir: string, files: Record<string, string>): string {
	for (const [file, text] of Object.entries(files)) {
		mkdirSync(join(dir, dirname(file)), { recursive: true });
		writeFileSync(join(dir, file), text);
	}
	git(["add", "-A"], dir);
	git(["commit", "-qm", "files"], dir);
	return git(["rev-parse", "HEAD"], dir);
}

/**
 * A hero to dock from, some-hero, with a user dir of its own. Its repo docs name two origins: `docked`, whose trunk's primary root
 * is of `kind`, and `plain`, a repo of no hero with a branch `work/plain`; its feat scopes plain on that branch and docked on none.
 */
export function dockHero(kind = "hero") {
	const root = (id: string, kind: string, name: string) => ({
		".nosedive/config.yaml": `id: ${id}\nroots:\n  - kb/${id}.md\n`,
		[`kb/${id}.md`]: `---\nkind: ${kind}\nid: ${id}\nname: ${name}\n---\n`,
	});
	const [heroId, dockedId, docked, plain, feat, owner] = [mintUuid(), mintUuid(), mintUuid(), mintUuid(), mintUuid(), mintUuid()];
	const dockedOrigin = gitRepo("dock-docked");
	commitAll(dockedOrigin, root(dockedId, kind, `some-${kind}`));
	const plainOrigin = gitRepo("dock-plain");
	commitAll(plainOrigin, { "README.md": "plain\n" });
	git(["checkout", "-q", "-b", "work/plain"], plainOrigin);
	const work = commitAll(plainOrigin, { "work.md": "work\n" });
	git(["checkout", "-q", "main"], plainOrigin);
	const repoDoc = (id: string, name: string, origin: string) =>
		`---\nkind: repo\nid: ${id}\nname: ${name}\nmeta:\n  trunk: main\n  remotes:\n    origin: ${JSON.stringify(origin)}\n---\n`;
	const hero = gitRepo("dock-hero");
	commitAll(hero, {
		...root(heroId, "hero", "some-hero"),
		[`.nosedive/repos/${docked}.md`]: repoDoc(docked, "docked", dockedOrigin),
		[`.nosedive/repos/${plain}.md`]: repoDoc(plain, "plain", plainOrigin),
		[`kb/${feat}.md`]: `---\nkind: feat\nid: ${feat}\nname: some-feat\nscopes:\n  - ${plain}:\n      work-branch: work/plain\n  - ${docked}: {}\n  - ${owner}:\n      canonical: true\n---\n`,
	});
	const user = tempDir("dock-user");
	process.env.NOSEDIVE_USER_DIR = user;
	const out: string[] = [];
	const ctx: Ctx = { cwd: hero, out: (text) => void out.push(text), err: (text) => void out.push(text), stdin: async () => "", capes: [cape] };
	return {
		hero, heroId, ids: { docked, plain, feat }, origins: { docked: dockedOrigin, plain: plainOrigin }, work, ctx, out,
		at: (name: string) => join(user, "docks", "some-hero", name),
		cache: (id: string) => cachePath(id === docked ? dockedOrigin : plainOrigin),
	};
}

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { a01a133548178739398941123114401ad as usageId } from "../src/a01a133548178739398941123114401ad.ts";
import { a01a1336cb234701bb0338faf5183960c as codeSection } from "../src/a01a1336cb234701bb0338faf5183960c.ts";
import { a01a1335480c776ba8945020d0af333eb as mintUuid } from "../src/a01a1335480c776ba8945020d0af333eb.ts";
import { after } from "node:test";
import { a01a1336a958f71c7beec4db3195c7966 as launch, type Cape, type Ctx } from "../src/a01a1336a958f71c7beec4db3195c7966.ts";
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

/**
 * A committed cape repo with one action, `greet <who>`, whose impl imports core's namespaced-uuid.
 * `link: false` leaves that import unlinked; `importing` swaps the imported core doc.
 */
export function greetCapeRepo(options: { link?: boolean; importing?: string } = {}): string {
	const dir = gitRepo("greet-cape");
	const imported = (options.importing ?? NAMESPACED_UUID).replace(/-/g, "");
	const usage = usageId("greet <who>", GREET);
	const hex = GREET.replace(/-/g, "");
	const links = options.link === false ? "" : `links:\n  - nosedive-core:${options.importing ?? NAMESPACED_UUID}:\n      rel: uses.action\n`;
	const doc = { name: "greet", gist: "Greets", usages: [{ id: usage, text: "greet <who>" }], top: true, text: "", body: "" };
	const files: Record<string, string> = {
		[`kb/${GREET}.md`]: `---\nkind: action\nid: ${GREET}\nname: greet\ngist: "Greets"\nmeta:\n  usages:\n    - greet <who>\n${links}---\n${codeSection("\n# Greet\n", doc, `a${hex}`)}`,
		[`src/a${hex}.ts`]: `import type { ActionCall } from "nosedive-core";\nimport { i${usage} } from "./i${usage}.ts";\n\nexport async function a${hex}(call: ActionCall) {\n\tif (call.usage === "u${usage}") return i${usage}(String(call.args.who), call.ctx);\n}\n`,
		[`src/i${usage}.ts`]: `import { a${imported} as namespacedUuid } from "nosedive-core";\n\nexport async function i${usage}(who: string, ctx: { out(text: string): void }) {\n\tctx.out(\`hello \${who} \${namespacedUuid(who, "${GREET}")}\`);\n}\n`,
		[`test/t${usage}.test.ts`]: 'import { test } from "node:test";\n\ntest("greet <who>", () => {});\n',
	};
	for (const [file, text] of Object.entries(files)) {
		mkdirSync(join(dir, dirname(file)), { recursive: true });
		writeFileSync(join(dir, file), text);
	}
	git(["add", "-A"], dir);
	git(["commit", "-qm", "greet cape"], dir);
	return dir;
}

/** Registers a repo doc named `name` in a bridge, cloned from `path` when given; returns its id. */
export async function registerRepo(bridge: string, name: string, path?: string): Promise<string> {
	const id = mintUuid();
	const meta = path === undefined ? "" : `meta:\n  remotes:\n    local: ${JSON.stringify(path)}\n`;
	writeFileSync(join(bridge, "kb", `${id}.md`), `---\nkind: repo\nid: ${id}\nname: ${name}\n${meta}---\n`);
	return id;
}

/** Names `actions` in a bridge's config. */
export function setActions(bridge: string, actions: Record<string, string>): void {
	const config = join(bridge, ".nosedive", "config.yaml");
	const kept = readFileSync(config, "utf8").replace(/\nactions:\n( {2}.*\n)*/, "\n");
	writeFileSync(config, `${kept}actions:\n${Object.entries(actions).map(([action, spec]) => `  ${action}: ${spec}\n`).join("")}`);
}

/** A seeded bridge in a fresh temp repo. */
export async function tempBridge(label: string): Promise<string> {
	const dir = gitRepo(label);
	ok(await run(["seed"], dir));
	return dir;
}

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a13a6aba3a763595bd67a4ee4d47bf as findRoot } from "./i01a13a6aba3a763595bd67a4ee4d47bf.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1335487e477549d84a6fc2c901bf6 as describeCapeSource } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
import { i01a1335488937f1c8c3983dd2950028e as checkCapeSource } from "./i01a1335488937f1c8c3983dd2950028e.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "./i01a1335483aa776cb84df698b04adc06.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a1336cb234701bb0338faf5183960c as codeSection } from "./i01a1336cb234701bb0338faf5183960c.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a14fb092177d36a478d40a47166c97 as gateUsage } from "./i01a14fb092177d36a478d40a47166c97.ts";
import { i01a14fdf275b70b48f86f7f5c651719d as kbDocKind } from "./i01a14fdf275b70b48f86f7f5c651719d.ts";
import { CORE_OWNER, i01a18e2a3b4b798d98068d4778a158e6 as docKind } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";

const QUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.md$/;
const CODE_KINDS = new Set(["action", "function", "migration"]);

export async function ic984cd607bf9568d97eb5ffb0b7da854(quid: string | undefined, ctx: Ctx): Promise<void> {
	const hero = findBridge(ctx.cwd);
	if (!hero) throw new Error("scaf runs from a hero or a cape repo, and there is no nosedive config here or above");
	const tree = hero.baseDir;
	const paths = quid === undefined ? walk(tree) : [locateDoc(hero, quid)?.path ?? walk(hero.dir, `${quid}.md`)[0]];
	if (quid !== undefined && paths[0] === undefined) throw new Error(`no doc ${quid} in ${hero.dir} or its workspace`);

	// Each action doc goes to the seeded repo holding it.
	const byRepo = new Map<string, string[]>();
	const skipped: string[] = [];
	const shown = (path: string) => relative(ctx.cwd, path).replace(/\\/g, "/");
	for (const path of paths as string[]) {
		const id = basename(path, ".md");
		const repo = holdingRepo(path);
		if (!isCodeDoc(path, repo)) {
			if (quid !== undefined) throw new Error(`${quid} is not an action doc`);
			continue;
		}
		if (!repo) skipped.push(`${shown(path)}: in no seeded repo`);
		else if (!findRoot(repo, "cape") && readRepoConfig(repo)?.workspace === undefined) skipped.push(`${shown(path)}: ${basename(repo)} is neither a cape nor a hero repo`);
		else byRepo.set(repo, [...(byRepo.get(repo) ?? []), id]);
	}
	if (quid !== undefined && skipped.length > 0) throw new Error(skipped[0]!);
	if (byRepo.size === 0 && skipped.length === 0) throw new Error(`no action docs under ${tree}`);

	const lines: string[] = [];
	for (const [repo, ids] of byRepo) lines.push(`${basename(repo)}:`, ...scaffold(repo, ids).map((line) => `  ${line}`));
	if (skipped.length > 0) lines.push("skipped:", ...skipped.map((line) => `  ${line}`));
	ctx.out(lines.join("\n"));
}

/** Writes what each of a repo's action docs lacks, and lists what is left. */
function scaffold(repoDir: string, ids: string[]): string[] {
	const { docs, entries } = describeCapeSource(repoDir);
	const kbDir = readRepoConfig(repoDir)!.kbDir;
	const chosen = entries.filter((entry) => ids.includes(entry.id));
	const missing = ids.filter((id) => !chosen.some((entry) => entry.id === id)).map((id) => `${id}: not in ${basename(repoDir)}'s kb`);
	// Core imports the launcher's types from its own source; any other cape, from core.
	const launcher = "i01a1336a958f71c7beec4db3195c7966";
	const types = existsSync(join(repoDir, "src", `${launcher}.ts`)) ? `./${launcher}.ts` : "nosedive-core";

	const created: string[] = [];
	const write = (file: string, text: string) => {
		const path = join(repoDir, file);
		if (existsSync(path)) return;
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, text);
		created.push(file);
	};

	const updated: string[] = [];
	for (const entry of chosen) {
		const doc = docs[entry.id]!;
		const raw = findKbDoc(kbDir, entry.id)!;
		const body = codeSection(raw.body, doc, entry.name);
		if (body !== raw.body) {
			writeKbDoc(raw.path, raw.yaml, body);
			updated.push(relative(repoDir, raw.path).replace(/\\/g, "/"));
		}
		if (doc.kind === "function") {
			write(`src/${entry.name}.ts`, internalStub(entry.name, doc.name));
			write(`src/${entry.name}.test.ts`, testStub(doc.name));
			continue;
		}
		write(`src/${entry.name}.ts`, entryStub(entry.name, doc.name, doc.usages, types));
		for (const usage of doc.usages) {
			// A gate's usage impl takes the pass's GateCtx, and is a test itself.
			if (gateUsage(usage.text)) {
				write(`src/i${usage.id}.ts`, gateStub(`i${usage.id}`, usage.text, types));
				continue;
			}
			write(`src/i${usage.id}.ts`, implStub(`i${usage.id}`, usage.text, types));
			write(`src/i${usage.id}.test.ts`, testStub(usage.text));
		}
	}

	const left = checkCapeSource(repoDir);
	const lines = [...created.map((file) => `created ${file}`), ...updated.map((file) => `updated ${file}`), ...missing.map((problem) => `skipped ${problem}`)];
	if (left.length > 0) lines.push("still to do:", ...left.map((problem) => `  ${problem}`));
	else if (lines.length === 0) lines.push("nothing to scaffold");
	return lines;
}

/** Every doc file under a directory, or just the one named, never entering node_modules, .git or .nosedive/capes. */
function walk(dir: string, only?: string): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { withFileTypes: true })
		.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
		.flatMap((entry) => {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) {
				const skip = entry.name === "node_modules" || entry.name === ".git" || (entry.name === "capes" && basename(dir) === ".nosedive");
				return skip ? [] : walk(path, only);
			}
			return entry.isFile() && (only ? entry.name === only : QUID.test(entry.name)) ? [path] : [];
		});
}

/** The seeded repo holding a doc: the nearest directory up with a nosedive config, not looking past the git checkout the doc is in. */
function holdingRepo(path: string): string | undefined {
	for (let dir = dirname(path); ; dir = dirname(dir)) {
		if (existsSync(join(dir, ".nosedive", "config.yaml"))) return dir;
		if (existsSync(join(dir, ".git")) || dirname(dir) === dir) return undefined;
	}
}

/** Whether a doc is of core's action, function or migration kind, as its repo spells it. */
function isCodeDoc(path: string, repo: string | undefined): boolean {
	try {
		if (!CODE_KINDS.has(kbDocKind(path) ?? "")) return false;
		const doc = { ...readKbDoc(readFileSync(path, "utf8"), path), path };
		const kind = docKind(doc, repo ? readRepoConfig(repo)?.id : undefined);
		return kind.owner === CORE_OWNER && CODE_KINDS.has(kind.name);
	} catch {
		return false;
	}
}

function entryStub(name: string, action: string, usages: { id: string; text: string }[], types: string): string {
	const imports = usages.map((usage) => `import { i${usage.id} } from "./i${usage.id}.ts";`);
	const cases = usages.map(
		(usage) => `\t\tcase "u${usage.id}": // ${usage.text}\n\t\t\treturn i${usage.id}(${gateUsage(usage.text) ? "call.gate!" : "call.args, call.ctx"});`,
	);
	return [
		`import type { ActionCall } from "${types}";`,
		...imports,
		"",
		`export async function ${name}(call: ActionCall): Promise<void> {`,
		"\tswitch (call.usage) {",
		...cases,
		"\t\tdefault:",
		`\t\t\tthrow new Error(\`${action} has no impl for \${call.usage}\`);`,
		"\t}",
		"}",
		"",
	].join("\n");
}

function implStub(name: string, usage: string, types: string): string {
	return [
		`import type { Args, Ctx } from "${types}";`,
		"",
		`export async function ${name}(args: Args, ctx: Ctx): Promise<void> {`,
		`\tthrow new Error(${JSON.stringify(`not written yet: ${usage}`)});`,
		"}",
		"",
	].join("\n");
}

function gateStub(name: string, gate: string, types: string): string {
	return [
		`import type { GateCtx } from "${types}";`,
		"",
		`export async function ${name}(ctx: GateCtx): Promise<void> {`,
		`\tthrow new Error(${JSON.stringify(`not written yet: ${gate}`)});`,
		"}",
		"",
	].join("\n");
}

function internalStub(name: string, action: string): string {
	return [
		`export function ${name}(): never {`,
		`\tthrow new Error(${JSON.stringify(`not written yet: ${action}`)});`,
		"}",
		"",
	].join("\n");
}

function testStub(title: string): string {
	return ['import { test } from "node:test";', "", `test(${JSON.stringify(title)}, { todo: "not written yet" }, () => {});`, ""].join("\n");
}

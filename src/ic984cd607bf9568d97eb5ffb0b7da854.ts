import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CODE_KINDS = new Set(["action", "function", "migration"]);

/** What a walk met: the docs named by a quid, and the symlinks it did not follow. */
type Found = { docs: string[]; links: string[] };

/** What is to be said about one repo: the action docs to scaffold, by the directory holding them, and its notes. */
type Group = { kbs: Map<string, string[]>; notes: string[] };

export async function ic984cd607bf9568d97eb5ffb0b7da854(quid: string | undefined, ctx: Ctx): Promise<void> {
	const wanted = quid?.toLowerCase();
	if (wanted !== undefined && !UUID.test(wanted)) throw new Error(`not a quid: ${quid}`);
	const hero = findBridge(ctx.cwd);
	if (!hero) throw new Error("scaf runs from a hero or a cape repo, and there is no nosedive config here or above");
	const tree = hero.baseDir;
	const rel = (path: string, from = hero.dir) => relative(from, path).replace(/\\/g, "/");
	const label = (repo: string) => rel(repo) || basename(hero.dir);

	let found: Found;
	if (wanted === undefined) found = walk(tree);
	else {
		const path = locateDoc(hero, wanted)?.path ?? walk(hero.dir, `${wanted}.md`).docs[0];
		if (path === undefined) throw new Error(`no doc ${wanted} in ${hero.dir} or its workspace`);
		found = { docs: [path], links: [] };
	}

	// Each action doc goes to the seeded repo holding it.
	const groups = new Map<string, Group>();
	const group = (repo: string) => groups.get(repo) ?? groups.set(repo, { kbs: new Map(), notes: [] }).get(repo)!;
	const skipped: string[] = [];
	for (const path of found.docs) {
		const repo = holdingRepo(path);
		const verdict = classify(path, repo);
		if (verdict === "other") {
			if (wanted !== undefined) throw new Error(`${wanted} is not an action doc`);
			continue;
		}
		const unusable = !repo ? "in no seeded repo" : !findRoot(repo, "cape") && readRepoConfig(repo)?.workspace === undefined ? `${label(repo)} is neither a cape nor a hero repo` : undefined;
		if (!repo || unusable) {
			skipped.push(typeof verdict === "string" ? `${rel(path)}: ${unusable}` : `error ${rel(path)}: ${verdict.error}`);
		} else if (typeof verdict !== "string") {
			group(repo).notes.push(`error ${rel(path, repo)}: ${verdict.error}`);
		} else {
			const kbs = group(repo).kbs;
			kbs.set(dirname(path), [...(kbs.get(dirname(path)) ?? []), basename(path, ".md")]);
		}
	}
	for (const link of found.links) {
		const repo = holdingRepo(link);
		if (repo) group(repo).notes.push(`not followed: ${rel(link, repo)}`);
		else skipped.push(`not followed: ${rel(link)}`);
	}
	if (wanted !== undefined) {
		const refused = skipped[0] ?? [...groups.values()].flatMap((each) => each.notes)[0];
		if (refused) throw new Error(refused);
	}
	if (groups.size === 0 && skipped.length === 0) throw new Error(`no action docs under ${tree}`);

	const lines: string[] = [];
	for (const [repo, each] of groups) {
		// A repo whose docs cannot all be read is reported, and the walk goes on to the next.
		let said: string[];
		try {
			said = scaffold(repo, each);
		} catch (err) {
			said = [...each.notes, `error: ${err instanceof Error ? err.message : String(err)}`];
		}
		lines.push(`${label(repo)}:`, ...said.map((line) => `  ${line}`));
	}
	if (skipped.length > 0) lines.push("skipped:", ...skipped.map((line) => `  ${line}`));
	ctx.out(lines.join("\n"));
}

/** Writes what each of a repo's action docs lacks, and lists what is left. */
function scaffold(repoDir: string, group: Group): string[] {
	// Core imports the launcher's types from its own source; any other cape, from core.
	const launcher = "i01a1336a958f71c7beec4db3195c7966";
	const types = existsSync(join(repoDir, "src", `${launcher}.ts`)) ? `./${launcher}.ts` : "nosedive-core";

	const created: string[] = [];
	const owned = new Set<string>();
	const write = (file: string, text: string) => {
		owned.add(file);
		const path = join(repoDir, file);
		if (existsSync(path)) return;
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, text);
		created.push(file);
	};

	const updated: string[] = [];
	for (const [kbDir, ids] of group.kbs) {
		const { docs, entries } = describeCapeSource(repoDir, false, false, kbDir);
		for (const id of ids) {
			const entry = entries.find((each) => each.id === id);
			if (!entry) throw new Error(`${id} in ${kbDir} did not read as an action doc`);
			const doc = docs[id]!;
			const raw = findKbDoc(kbDir, id)!;
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
	}

	// The check reads only the primary kb, so it does not know the files written for a doc in another root.
	const left = group.kbs.size > 0 ? checkCapeSource(repoDir).filter((problem) => ![...owned].some((file) => problem.startsWith(`${file}: no doc`))) : [];
	const lines = [...created.map((file) => `created ${file}`), ...updated.map((file) => `updated ${file}`), ...group.notes];
	if (left.length > 0) lines.push("still to do:", ...left.map((problem) => `  ${problem}`));
	else if (lines.length === 0) lines.push("nothing to scaffold");
	return lines;
}

/** The docs named by a quid under a directory, or just the one file named, never entering node_modules, .git or .nosedive/capes, and never following a symlink. */
function walk(dir: string, only?: string): Found {
	const found: Found = { docs: [], links: [] };
	if (!existsSync(dir)) return found;
	const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
	for (const entry of entries) {
		const path = join(dir, entry.name);
		if (entry.name === "node_modules" || entry.name === ".git" || (entry.name === "capes" && basename(dir) === ".nosedive")) continue;
		const named = only ? entry.name.toLowerCase() === only : UUID.test(entry.name.replace(/\.md$/, "").toLowerCase()) && entry.name.endsWith(".md");
		if (entry.isSymbolicLink()) {
			// Only a link that could hide docs is worth a line: one to a directory, or one named as a doc.
			if (named || statSync(path, { throwIfNoEntry: false })?.isDirectory()) found.links.push(path);
		} else if (entry.isDirectory()) {
			const inside = walk(path, only);
			found.docs.push(...inside.docs);
			found.links.push(...inside.links);
		} else if (entry.isFile() && named) found.docs.push(path);
	}
	return found;
}

/** The seeded repo holding a doc: the nearest directory up with a nosedive config, not looking past the git checkout the doc is in. */
function holdingRepo(path: string): string | undefined {
	for (let dir = dirname(path); ; dir = dirname(dir)) {
		if (existsSync(join(dir, ".nosedive", "config.yaml"))) return dir;
		if (existsSync(join(dir, ".git")) || dirname(dir) === dir) return undefined;
	}
}

/**
 * Whether a doc is of core's action, function or migration kind, as its repo spells it: `code`, `other`, or the error that kept it from being read.
 * In no seeded repo, a doc of those kinds with no owner counts: it is reported as an action nothing can scaffold.
 */
function classify(path: string, repo: string | undefined): "code" | "other" | { error: string } {
	try {
		if (!CODE_KINDS.has(kbDocKind(path) ?? "")) return "other";
		const doc = { ...readKbDoc(readFileSync(path, "utf8")), path };
		const kind = docKind(doc, repo ? readRepoConfig(repo)?.id : undefined);
		const ours = kind.owner === CORE_OWNER || (repo === undefined && kind.owner === undefined);
		return ours && CODE_KINDS.has(kind.name) ? "code" : "other";
	} catch (err) {
		return { error: err instanceof Error ? err.message : String(err) };
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

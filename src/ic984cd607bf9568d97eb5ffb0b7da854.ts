import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a13a6aba3a763595bd67a4ee4d47bf as findRoot } from "./i01a13a6aba3a763595bd67a4ee4d47bf.ts";
import { i01a1335487e477549d84a6fc2c901bf6 as describeCapeSource } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
import { i01a1335488937f1c8c3983dd2950028e as checkCapeSource } from "./i01a1335488937f1c8c3983dd2950028e.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "./i01a1335483aa776cb84df698b04adc06.ts";
import { i01a1336cb234701bb0338faf5183960c as codeSection } from "./i01a1336cb234701bb0338faf5183960c.ts";
import { i01a14fb092177d36a478d40a47166c97 as gateUsage } from "./i01a14fb092177d36a478d40a47166c97.ts";

export async function ic984cd607bf9568d97eb5ffb0b7da854(quid: string | undefined, ctx: Ctx): Promise<void> {
	const repoDir = gitRoot(ctx.cwd);
	const root = findRoot(repoDir);
	if (root?.kind !== "cape" && root?.kind !== "base") {
		throw new Error(`scaf runs in a cape or a base, and ${root ? `this repo's root is a ${root.kind}` : "this repo has no root"}: \`nosedive seed --root-kind cape\` makes a cape`);
	}
	const { docs, entries } = describeCapeSource(repoDir);
	const kbDir = root.bridge.kbDir;
	const chosen = quid === undefined ? entries : entries.filter((entry) => entry.id === quid);
	if (chosen.length === 0) throw new Error(quid ? `no action doc ${quid} in ${kbDir}` : `no action docs in ${kbDir}`);
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
		const hex = entry.name.slice(1);
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

	for (const file of created) ctx.out(`created ${file}`);
	for (const file of updated) ctx.out(`updated ${file}`);
	const left = checkCapeSource(repoDir);
	if (left.length > 0) ctx.out(["still to do:", ...left.map((problem) => `  ${problem}`)].join("\n"));
	else if (created.length === 0 && updated.length === 0) ctx.out("nothing to scaffold");
}

function gitRoot(cwd: string): string {
	const result = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
	if (result.status !== 0) throw new Error("scaf runs in a cape or a base, and this is not a git repo");
	return result.stdout.trim();
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

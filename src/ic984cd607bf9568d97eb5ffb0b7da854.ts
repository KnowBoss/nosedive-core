import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Ctx } from "./main.ts";
import { a01a1335487e477549d84a6fc2c901bf6 as describeCapeSource } from "./a01a1335487e477549d84a6fc2c901bf6.ts";
import { a01a1335488937f1c8c3983dd2950028e as checkCapeSource } from "./a01a1335488937f1c8c3983dd2950028e.ts";

export async function ic984cd607bf9568d97eb5ffb0b7da854(quid: string | undefined, ctx: Ctx): Promise<void> {
	const repoDir = gitRoot(ctx.cwd);
	const { docs, entries } = describeCapeSource(repoDir);
	const chosen = quid === undefined ? entries : entries.filter((entry) => entry.id === quid);
	if (chosen.length === 0) throw new Error(quid ? `no action doc ${quid} in ${join(repoDir, "kb")}` : "no action docs in kb/");
	const types = existsSync(join(repoDir, "src", "main.ts")) ? "./main.ts" : "nosedive-core";

	const created: string[] = [];
	const write = (file: string, text: string) => {
		const path = join(repoDir, file);
		if (existsSync(path)) return;
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, text);
		created.push(file);
	};

	for (const entry of chosen) {
		const doc = docs[entry.id]!;
		const hex = entry.name.slice(1);
		if (doc.usages.length === 0) {
			write(`src/${entry.name}.ts`, internalStub(entry.name, doc.name));
			write(`test/t${hex}.test.ts`, testStub(doc.name));
			continue;
		}
		write(`src/${entry.name}.ts`, entryStub(entry.name, doc.name, doc.usages, types));
		for (const usage of doc.usages) {
			write(`src/i${usage.id}.ts`, implStub(`i${usage.id}`, usage.text, types));
			write(`test/t${usage.id}.test.ts`, testStub(usage.text));
		}
	}

	for (const file of created) ctx.out(`created ${file}`);
	const left = checkCapeSource(repoDir);
	if (left.length > 0) ctx.out(["still to do:", ...left.map((problem) => `  ${problem}`)].join("\n"));
	else if (created.length === 0) ctx.out("nothing to scaffold");
}

function gitRoot(cwd: string): string {
	const result = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
	if (result.status !== 0) throw new Error("scaf runs in a cape repo, and this is not a git repo");
	return result.stdout.trim();
}

function entryStub(name: string, action: string, usages: { id: string; text: string }[], types: string): string {
	const imports = usages.map((usage) => `import { i${usage.id} } from "./i${usage.id}.ts";`);
	const cases = usages.map(
		(usage) => `\t\tcase "u${usage.id}": // ${usage.text}\n\t\t\treturn i${usage.id}(call.args, call.ctx);`,
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

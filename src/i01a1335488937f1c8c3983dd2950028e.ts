import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { i01a1335487e477549d84a6fc2c901bf6 as describeCapeSource } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
import { i01a1336cb234701bb0338faf5183960c as codeSection } from "./i01a1336cb234701bb0338faf5183960c.ts";

const FRAMEWORK = new Set(["test/harness.ts"]);

export function i01a1335488937f1c8c3983dd2950028e(repoDir: string): string[] {
	const { docs, entries } = describeCapeSource(repoDir);
	const problems: string[] = [];
	const expected = new Set<string>();
	const names = new Map<string, string>();

	for (const entry of entries) {
		const doc = docs[entry.id]!;
		const hex = entry.name.slice(1);
		const label = `${doc.name || entry.id} (kb/${entry.id}.md)`;
		if (!doc.name) problems.push(`${label}: has no name`);
		const clash = names.get(doc.name);
		if (clash) problems.push(`${label}: name also used by kb/${clash}.md`);
		names.set(doc.name, entry.id);
		if (codeSection(doc.body, doc, entry.name).trim() !== doc.body.trim()) {
			problems.push(`${label}: its ## Code section is missing or stale; run scaf`);
		}

		const entryFile = `src/${entry.name}.ts`;
		expected.add(entryFile);
		const entrySource = exportingSource(repoDir, entryFile, entry.name, label, problems);

		if (doc.kind === "action" && doc.usages.length === 0) problems.push(`${label}: an action lists usages; make it a function if users cannot call it`);
		if (doc.kind === "function" && doc.usages.length > 0) problems.push(`${label}: a function has no usages; make it an action if users can call it`);
		// A gate is a test, and an action's usages have theirs, so only a function has its own.
		if (doc.kind === "function") {
			expected.add(`test/t${hex}.test.ts`);
			if (!existsSync(join(repoDir, `test/t${hex}.test.ts`))) problems.push(`${label}: missing test/t${hex}.test.ts`);
		}
		for (const usage of doc.usages) {
			const usageLabel = `${label} usage \`${usage.text}\``;
			if (usage.text !== doc.name && !usage.text.startsWith(`${doc.name} `)) {
				problems.push(`${usageLabel}: does not start with ${doc.name}`);
			}
			const impl = `src/i${usage.id}.ts`;
			const test = `test/t${usage.id}.test.ts`;
			expected.add(impl);
			expected.add(test);
			exportingSource(repoDir, impl, `i${usage.id}`, usageLabel, problems);
			if (!existsSync(join(repoDir, test))) problems.push(`${usageLabel}: missing ${test}`);
			if (entrySource !== undefined && !entrySource.includes(`i${usage.id}`)) {
				problems.push(`${usageLabel}: ${entryFile} never calls i${usage.id}`);
			}
		}
	}

	for (const dir of ["src", "test"]) {
		if (!existsSync(join(repoDir, dir))) continue;
		for (const file of readdirSync(join(repoDir, dir))) {
			const path = `${dir}/${file}`;
			if (!expected.has(path) && !FRAMEWORK.has(path)) problems.push(`${path}: no doc accounts for it`);
		}
	}
	return problems;
}

function exportingSource(repoDir: string, file: string, name: string, label: string, problems: string[]) {
	const path = join(repoDir, file);
	if (!existsSync(path)) {
		problems.push(`${label}: missing ${file}`);
		return undefined;
	}
	const source = readFileSync(path, "utf8");
	if (!new RegExp(`export (async )?(function|const) ${name}\\b`).test(source)) {
		problems.push(`${label}: ${file} does not export ${name}`);
	}
	return source;
}

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { i01a1335487e477549d84a6fc2c901bf6 as describeCapeSource } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
import { i01a1336cb234701bb0338faf5183960c as codeSection } from "./i01a1336cb234701bb0338faf5183960c.ts";
import { i01a14fb092177d36a478d40a47166c97 as gateUsage } from "./i01a14fb092177d36a478d40a47166c97.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";

const FRAMEWORK = new Set(["test/harness.ts"]);

export function i01a1335488937f1c8c3983dd2950028e(repoDir: string): string[] {
	const { docs, entries } = describeCapeSource(repoDir);
	const problems: string[] = [];
	const expected = new Set<string>();
	const names = new Map<string, string>();
	const kbDir = readRepoConfig(repoDir)?.kbDir ?? join(repoDir, "kb");
	const docPath = (id: string) => relative(repoDir, join(kbDir, `${id}.md`)).replace(/\\/g, "/");

	for (const entry of entries) {
		const doc = docs[entry.id]!;
		const hex = entry.name.slice(1);
		const label = `${doc.name || entry.id} (${docPath(entry.id)})`;
		if (!doc.name) problems.push(`${label}: has no name`);
		const clash = names.get(doc.name);
		if (clash) problems.push(`${label}: name also used by ${docPath(clash)}`);
		names.set(doc.name, entry.id);
		if (codeSection(doc.body, doc, entry.name).trim() !== doc.body.trim()) {
			problems.push(`${label}: its ## Code section is missing or stale; run scaf`);
		}

		const entryFile = `src/${entry.name}.ts`;
		expected.add(entryFile);
		const entrySource = exportingSource(repoDir, entryFile, entry.name, label, problems);

		if (doc.kind === "action" && doc.usages.length === 0) problems.push(`${label}: an action lists usages; make it a function if users cannot call it`);
		if (doc.kind === "function" && doc.usages.length > 0) problems.push(`${label}: a function has no usages; make it an action if users can call it`);
		// An action's usages have their tests, so only a function has its own.
		if (doc.kind === "function") {
			expected.add(`src/i${hex}.test.ts`);
			if (!existsSync(join(repoDir, `src/i${hex}.test.ts`))) problems.push(`${label}: missing src/i${hex}.test.ts`);
		}
		// An action is a command, its usages starting with its name, or a gate, theirs starting pass --<sect> <kind>.
		const gates = doc.usages.filter((usage) => gateUsage(usage.text)).length;
		if (gates > 0 && gates < doc.usages.length) problems.push(`${label}: its usages start both with its name and with pass --<sect> <kind>; an action is a command or a gate`);
		for (const usage of doc.usages) {
			const usageLabel = `${label} usage \`${usage.text}\``;
			const gate = gateUsage(usage.text) !== undefined;
			if (!gate && usage.text !== doc.name && !usage.text.startsWith(`${doc.name} `)) {
				problems.push(`${usageLabel}: starts neither with ${doc.name} nor with pass --<sect> <kind>`);
			}
			const impl = `src/i${usage.id}.ts`;
			const test = `src/i${usage.id}.test.ts`;
			expected.add(impl);
			exportingSource(repoDir, impl, `i${usage.id}`, usageLabel, problems);
			// A gate's usage is a test, so it has none of its own.
			if (!gate) {
				expected.add(test);
				if (!existsSync(join(repoDir, test))) problems.push(`${usageLabel}: missing ${test}`);
			}
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

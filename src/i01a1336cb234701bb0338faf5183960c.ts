import type { CapeDoc } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a14fb092177d36a478d40a47166c97 as gateUsage } from "./i01a14fb092177d36a478d40a47166c97.ts";

export function i01a1336cb234701bb0338faf5183960c(body: string, doc: CapeDoc, entryName: string): string {
	const file = (path: string) => `[${path}](../${path})`;
	const lines = ["## Code", ""];
	if (doc.kind === "function") {
		lines.push(`- Function: ${file(`src/${entryName}.ts`)}`, `- Tests: ${file(`src/${entryName}.test.ts`)}`);
	} else {
		lines.push(`- Entrypoint: ${file(`src/${entryName}.ts`)}`);
		for (const usage of doc.usages) {
			// A pass gate's usage is a test, so it has none of its own; a crud gate's has (see crud-gates).
			const gate = gateUsage(usage.text);
			const tests = gate && !gate.when ? "" : `, [tests](../src/i${usage.id}.test.ts)`;
			lines.push(`- \`${usage.text}\`: [impl](../src/i${usage.id}.ts)${tests}`);
		}
	}
	let rest = body.replace(/(^|\n)## Code\n[\s\S]*?(?=\n## |$)/, "").trimEnd();
	// An action's prose is its ## Usage, what --help --more prints.
	if (doc.kind === "action" && !/(^|\n)## Usage(\n|$)/.test(rest)) {
		const lead = /^\n*/.exec(rest)![0];
		const title = /^# [^\n]*/.exec(rest.slice(lead.length))?.[0] ?? "";
		const prose = rest.slice(lead.length + title.length).trim();
		rest = `${lead}${title ? `${title}\n\n` : ""}## Usage${prose ? `\n\n${prose}` : ""}`;
	}
	return `${rest}\n\n${lines.join("\n")}\n`;
}

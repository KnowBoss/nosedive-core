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
			// A gate's usage is a test, so it has none of its own.
			const tests = gateUsage(usage.text) ? "" : `, [tests](../src/i${usage.id}.test.ts)`;
			lines.push(`- \`${usage.text}\`: [impl](../src/i${usage.id}.ts)${tests}`);
		}
	}
	const rest = body.replace(/(^|\n)## Code\n[\s\S]*?(?=\n## |$)/, "").trimEnd();
	return `${rest}\n\n${lines.join("\n")}\n`;
}

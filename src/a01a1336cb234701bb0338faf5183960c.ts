import type { CapeDoc } from "./a01a1336a958f71c7beec4db3195c7966.ts";

export function a01a1336cb234701bb0338faf5183960c(body: string, doc: CapeDoc, entryName: string): string {
	const hex = entryName.slice(1);
	const file = (path: string) => `[${path}](../${path})`;
	const lines = ["## Code", ""];
	if (doc.kind === "gate") {
		lines.push(`- Gate: ${file(`src/${entryName}.ts`)}`);
	} else if (doc.usages.length === 0) {
		lines.push(`- Function: ${file(`src/${entryName}.ts`)}`, `- Tests: ${file(`test/t${hex}.test.ts`)}`);
	} else {
		lines.push(`- Entrypoint: ${file(`src/${entryName}.ts`)}`);
		for (const usage of doc.usages) {
			lines.push(`- \`${usage.text}\`: [impl](../src/i${usage.id}.ts), [tests](../test/t${usage.id}.test.ts)`);
		}
	}
	const rest = body.replace(/(^|\n)## Code\n[\s\S]*?(?=\n## |$)/, "").trimEnd();
	return `${rest}\n\n${lines.join("\n")}\n`;
}

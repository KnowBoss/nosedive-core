import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1471723807d6e8ef228ad9472fff7 as readText } from "./i01a1471723807d6e8ef228ad9472fff7.ts";
import { i01a1480bf8327315b11347f5e5f118a1 as dropKbDocs } from "./i01a1480bf8327315b11347f5e5f118a1.ts";

const QUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function i4d86421616655ccebfcb884e0f35ff56(source: string, hard: boolean, ctx: Ctx): Promise<void> {
	const ids = (await readText(source, ctx))
		.split(/\r?\n/)
		.map((line) => line.trim().toLowerCase())
		.filter(Boolean);
	const bad = ids.filter((id) => !QUID.test(id));
	if (bad.length > 0) throw new Error(`--drop-list takes one quid per line, not: ${bad.join(", ")}`);
	if (ids.length === 0) throw new Error("--drop-list found no quids to drop");
	ctx.out(dropKbDocs(ctx.cwd, ids, hard, ctx.capes).join("\n"));
}

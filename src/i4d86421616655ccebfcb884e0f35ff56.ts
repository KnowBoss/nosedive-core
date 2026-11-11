import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1471723807d6e8ef228ad9472fff7 as readText } from "./i01a1471723807d6e8ef228ad9472fff7.ts";
import { i01a1480bf8327315b11347f5e5f118a1 as dropKbDocs } from "./i01a1480bf8327315b11347f5e5f118a1.ts";
import { gateDrop } from "./i01a1b453a16c799bb9ce20fad1a9075b.ts";

const QUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** A line may be a doc's path, as `next` prints it (listed-paths-accepted). */
const LISTED = /^(?:.*[\\/])?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.md$/;

/**
 * Drops every doc a list names, together.
 *
 * The source holds one quid per line, a path ending `<quid>.md` as `next` prints it counting as its quid. Only links and mentions from docs outside the list count, so docs that mention each other go at once, in one commit per repo.
 *
 * @param source Where the list is read from: a file, or `-` for stdin.
 * @param hard Whether to drop durable docs too.
 * @param ctx Where it runs, and how it reads and prints.
 * @param sure Whether to drop docs that hang from no doc too.
 * @returns Nothing; it prints what it dropped.
 * @nosedive-feat 01a1336b-c0b8-7cde-b7c6-285196062297
 */
export async function i4d86421616655ccebfcb884e0f35ff56(source: string, hard: boolean, ctx: Ctx, sure = false): Promise<void> {
	const ids = (await readText(source, ctx))
		.split(/\r?\n/)
		.map((line) => line.trim().toLowerCase().replace(LISTED, "$1"))
		.filter(Boolean);
	const bad = ids.filter((id) => !QUID.test(id));
	if (bad.length > 0) throw new Error(`--drop-list takes one quid per line, not: ${bad.join(", ")}`);
	if (ids.length === 0) throw new Error("--drop-list found no quids to drop");
	await gateDrop(ids, ctx);
	ctx.out(dropKbDocs(ctx.cwd, ids, hard, ctx.capes, sure, ctx.err).join("\n"));
}

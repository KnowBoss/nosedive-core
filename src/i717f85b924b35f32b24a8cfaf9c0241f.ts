import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1480bf8327315b11347f5e5f118a1 as dropKbDocs } from "./i01a1480bf8327315b11347f5e5f118a1.ts";
import { gateDrop } from "./i01a1b453a16c799bb9ce20fad1a9075b.ts";

/**
 * Drops a doc, which the doc it hangs from records.
 *
 * The doc must be droppable under its kind's Drop when, and hang from a doc that records what it held. A durable doc is refused unless `--hard`. A dropped doc is still in git.
 *
 * @param quid The doc to drop.
 * @param hard Whether to drop a durable doc too.
 * @param ctx Where it runs, and how it reads and prints.
 * @returns Nothing; it prints what it dropped.
 * @nosedive-feat 01a1336b-c0b8-7cde-b7c6-285196062297
 */
export async function i717f85b924b35f32b24a8cfaf9c0241f(quid: string, hard: boolean, ctx: Ctx): Promise<void> {
	await gateDrop([quid], ctx);
	ctx.out(dropKbDocs(ctx.cwd, [quid], hard, ctx.capes, false, ctx.err).join("\n"));
}

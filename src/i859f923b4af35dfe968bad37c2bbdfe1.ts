import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1480bf8327315b11347f5e5f118a1 as dropKbDocs } from "./i01a1480bf8327315b11347f5e5f118a1.ts";
import { gateDrop } from "./i01a1b453a16c799bb9ce20fad1a9075b.ts";

/**
 * Drops a doc though it hangs from no doc.
 *
 * None then records what it held; otherwise it is `crud --drop`.
 *
 * @param quid The doc to drop.
 * @param hard Whether to drop a durable doc too.
 * @param ctx Where it runs, and how it reads and prints.
 * @returns Nothing; it prints what it dropped.
 * @nosedive-feat 01a1336b-c0b8-7cde-b7c6-285196062297
 */
export async function i859f923b4af35dfe968bad37c2bbdfe1(quid: string, hard: boolean, ctx: Ctx): Promise<void> {
	await gateDrop([quid], ctx);
	ctx.out(dropKbDocs(ctx.cwd, [quid], hard, ctx.capes, true, ctx.err).join("\n"));
}

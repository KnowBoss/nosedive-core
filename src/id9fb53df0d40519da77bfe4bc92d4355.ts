import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i4d86421616655ccebfcb884e0f35ff56 as dropList } from "./i4d86421616655ccebfcb884e0f35ff56.ts";

/**
 * Drops every doc a list names though some hang from no doc.
 *
 * None of those then records what it held; otherwise it is `crud --drop-list`.
 *
 * @param source Where the list is read from: a file, or `-` for stdin.
 * @param hard Whether to drop durable docs too.
 * @param ctx Where it runs, and how it reads and prints.
 * @returns Nothing; it prints what it dropped.
 * @nosedive-feat 01a1336b-c0b8-7cde-b7c6-285196062297
 */
export async function id9fb53df0d40519da77bfe4bc92d4355(source: string, hard: boolean, ctx: Ctx): Promise<void> {
	return dropList(source, hard, ctx, true);
}

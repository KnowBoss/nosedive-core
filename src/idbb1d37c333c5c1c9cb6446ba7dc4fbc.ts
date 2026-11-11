import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "./i01a1335480c776ba8945020d0af333eb.ts";

/**
 * Prints new uuid v7 ids, one per successive millisecond.
 *
 * The first id is stamped now unless a time is given, and each next one a millisecond later, so the ids sort as they were printed.
 *
 * @param count How many ids to print.
 * @param start The first id's time, in UTC milliseconds.
 * @param ctx Where it runs, and how it reads and prints.
 * @returns Nothing; it prints the ids.
 * @nosedive-feat 01a1336b-c0b8-7cde-b7c6-285196062297
 */
export async function idbb1d37c333c5c1c9cb6446ba7dc4fbc(count: number, start: number, ctx: Ctx): Promise<void> {
	for (let i = 0; i < count; i += 1) ctx.out(mintUuid(start + i));
}

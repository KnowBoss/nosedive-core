import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i9dfd0b735ec95af1948f2b3311749c52 as dock } from "./i9dfd0b735ec95af1948f2b3311749c52.ts";

/**
 * Checks a repo, or a feat's repos, out read-only at a head.
 *
 * As `dock <ref>` does, with every repo, the hero's own too, docked read-only at the head given.
 *
 * @param ref What to dock: a repo or feat quid, a remote, or a repo name.
 * @param head The head to dock every repo at.
 * @param ctx Where it runs, and how it reads and prints.
 * @returns Nothing; it prints where it docked.
 * @nosedive-feat 01a1336b-c0b8-7cde-b7c6-285196062297
 */
export async function i0ac895fb79d75e2fb42b98f6d0bf3611(ref: string, head: string, ctx: Ctx): Promise<void> {
	return dock(ref, head, ctx);
}

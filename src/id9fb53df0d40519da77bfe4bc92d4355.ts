import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i4d86421616655ccebfcb884e0f35ff56 as dropList } from "./i4d86421616655ccebfcb884e0f35ff56.ts";

/** crud --drop-list <source> --sure: drops them though some hang from no doc, so none records what they held. */
export async function id9fb53df0d40519da77bfe4bc92d4355(source: string, hard: boolean, ctx: Ctx): Promise<void> {
	return dropList(source, hard, ctx, true);
}

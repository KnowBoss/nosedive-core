import type { Ctx } from "./main.ts";
import { a01a1335487317576a0afd03506ef5555 as readSource } from "./a01a1335487317576a0afd03506ef5555.ts";
import { a01a133588b1f7d4ea13f1b5e79f02e4c as mergeKeyedEntries } from "./a01a133588b1f7d4ea13f1b5e79f02e4c.ts";
import { a01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "./a01a133588bcc7f8bae725ff70d8f6800.ts";

export async function i21be7cc759fb5c758e11cffdb2630902(quid: string, source: string, ctx: Ctx): Promise<void> {
	const patch = await readSource(source, ctx);
	if (patch === null || typeof patch !== "object" || Array.isArray(patch)) throw new Error("--links takes a mapping");
	ctx.out(updateKbDocField(ctx.cwd, quid, "links", (links) => mergeKeyedEntries(links, patch as Record<string, unknown>)));
}

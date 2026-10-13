import type { Ctx } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a1335487317576a0afd03506ef5555 as readSource } from "./a01a1335487317576a0afd03506ef5555.ts";
import { a01a13354867d7a528cbad55b80708e50 as mergePatch } from "./a01a13354867d7a528cbad55b80708e50.ts";
import { a01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "./a01a133588bcc7f8bae725ff70d8f6800.ts";

export async function i3ac641d4a9d757a48df1f1de031be120(quid: string, source: string, ctx: Ctx): Promise<void> {
	const patch = await readSource(source, ctx);
	if (patch === null || typeof patch !== "object" || Array.isArray(patch)) throw new Error("--meta takes a mapping");
	ctx.out(updateKbDocField(ctx.cwd, quid, "meta", (meta) => mergePatch(meta ?? {}, patch)));
}

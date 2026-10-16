import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "./i01a133588bcc7f8bae725ff70d8f6800.ts";

export async function i971c8e5c145b560390e48ad4702e2fa5(quid: string, name: string, ctx: Ctx): Promise<void> {
	ctx.out(updateKbDocField(ctx.cwd, quid, "name", () => name));
}

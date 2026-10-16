import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "./i01a133588bcc7f8bae725ff70d8f6800.ts";

export async function i7713e1ddd9c454948ec7f940be7ffe6f(quid: string, gist: string, ctx: Ctx): Promise<void> {
	if (!gist.trim()) throw new Error("--gist takes a gist");
	ctx.out(updateKbDocField(ctx.cwd, quid, "gist", () => gist.trim()));
}

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";

export async function i01a1471723807d6e8ef228ad9472fff7(source: string, ctx: Ctx): Promise<string> {
	return source === "-" ? ctx.stdin() : readFileSync(resolve(ctx.cwd, source), "utf8");
}

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";

export async function i01a1335487317576a0afd03506ef5555(value: string, ctx: Ctx): Promise<unknown> {
	const text = value === "-" ? await ctx.stdin() : readFileSync(resolve(ctx.cwd, value), "utf8");
	return parse(text);
}

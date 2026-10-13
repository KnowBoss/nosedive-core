import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import type { Ctx } from "./main.ts";

export async function a01a1335487317576a0afd03506ef5555(value: string, ctx: Ctx): Promise<unknown> {
	const text = value === "-" ? await ctx.stdin() : readFileSync(resolve(ctx.cwd, value), "utf8");
	return parse(text);
}

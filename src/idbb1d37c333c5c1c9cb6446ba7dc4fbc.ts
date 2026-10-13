import type { Ctx } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a1335480c776ba8945020d0af333eb as mintUuid } from "./a01a1335480c776ba8945020d0af333eb.ts";

export async function idbb1d37c333c5c1c9cb6446ba7dc4fbc(count: number, start: number, ctx: Ctx): Promise<void> {
	for (let i = 0; i < count; i += 1) ctx.out(mintUuid(start + i));
}

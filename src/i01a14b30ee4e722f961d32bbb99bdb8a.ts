import type { ActionCall } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { ib4959fbe2cef5f0ba22879fe0bbd5c00 } from "./ib4959fbe2cef5f0ba22879fe0bbd5c00.ts";

export async function i01a14b30ee4e722f961d32bbb99bdb8a(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "ub4959fbe2cef5f0ba22879fe0bbd5c00": // pass [<argv>...]
			return ib4959fbe2cef5f0ba22879fe0bbd5c00((call.args.argv as string[] | undefined) ?? [], call.ctx);
		default:
			throw new Error(`pass has no impl for ${call.usage}`);
	}
}

import type { ActionCall } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i413facba4ec6596291333591aab5b760 } from "./i413facba4ec6596291333591aab5b760.ts";

export async function i01a15c11fcd8768d96ea0158106ba26f(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "u413facba4ec6596291333591aab5b760": // pass --status <repo>
			return i413facba4ec6596291333591aab5b760(call.gate!);
		default:
			throw new Error(`status has no impl for ${call.usage}`);
	}
}

import type { ActionCall } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { ic984cd607bf9568d97eb5ffb0b7da854 } from "./ic984cd607bf9568d97eb5ffb0b7da854.ts";

export async function i01a133547f5f7c45a3fb2ac0e3a7678e(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "uc984cd607bf9568d97eb5ffb0b7da854":
			// scaf [<quid>]
			return ic984cd607bf9568d97eb5ffb0b7da854(call.args.quid as string | undefined, call.ctx);
		default:
			throw new Error(`scaf has no impl for ${call.usage}`);
	}
}

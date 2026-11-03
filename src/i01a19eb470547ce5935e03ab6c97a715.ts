import type { ActionCall } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { ibc5113a84ba55195add71cac33f0bf20 } from "./ibc5113a84ba55195add71cac33f0bf20.ts";

export async function i01a19eb470547ce5935e03ab6c97a715(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "ubc5113a84ba55195add71cac33f0bf20": // next
			return ibc5113a84ba55195add71cac33f0bf20(call.args, call.ctx);
		default:
			throw new Error(`next has no impl for ${call.usage}`);
	}
}

import type { ActionCall } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { ic984cd607bf9568d97eb5ffb0b7da854 } from "./ic984cd607bf9568d97eb5ffb0b7da854.ts";

const QUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function a01a133547f5f7c45a3fb2ac0e3a7678e(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "uc984cd607bf9568d97eb5ffb0b7da854": {
			// scaf [<quid>]
			const quid = call.args.quid;
			if (quid !== undefined && !QUID.test(String(quid))) throw new Error(`not a quid: ${String(quid)}`);
			return ic984cd607bf9568d97eb5ffb0b7da854(quid as string | undefined, call.ctx);
		}
		default:
			throw new Error(`scaf has no impl for ${call.usage}`);
	}
}

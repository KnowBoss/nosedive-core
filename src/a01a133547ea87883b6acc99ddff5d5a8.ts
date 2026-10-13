import type { ActionCall } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { ie7ff577094bd5fe08f833f3cfaad9b63 } from "./ie7ff577094bd5fe08f833f3cfaad9b63.ts";

export async function a01a133547ea87883b6acc99ddff5d5a8(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "ue7ff577094bd5fe08f833f3cfaad9b63": // seed [--no-capes]
			return ie7ff577094bd5fe08f833f3cfaad9b63(call.args.noCapes === true, call.ctx);
		default:
			throw new Error(`seed has no impl for ${call.usage}`);
	}
}

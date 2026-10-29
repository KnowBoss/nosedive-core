import type { ActionCall } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i439dab683e1b51e5a0e7d0430aa1348a } from "./i439dab683e1b51e5a0e7d0430aa1348a.ts";

export async function i01a185168bb079b8be334b6d86dba95a(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "u439dab683e1b51e5a0e7d0430aa1348a": // pass --doff-cape <repo>
			return i439dab683e1b51e5a0e7d0430aa1348a(call.gate!);
		default:
			throw new Error(`doff-cape has no impl for ${call.usage}`);
	}
}

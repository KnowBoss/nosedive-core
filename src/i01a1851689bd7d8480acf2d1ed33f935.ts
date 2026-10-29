import type { ActionCall } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { ib1271b71723d57c39b4dd36252311704 } from "./ib1271b71723d57c39b4dd36252311704.ts";

export async function i01a1851689bd7d8480acf2d1ed33f935(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "ub1271b71723d57c39b4dd36252311704": // pass --attach-cape <repo> [--ref <ref>]
			return ib1271b71723d57c39b4dd36252311704(call.gate!);
		default:
			throw new Error(`attach-cape has no impl for ${call.usage}`);
	}
}

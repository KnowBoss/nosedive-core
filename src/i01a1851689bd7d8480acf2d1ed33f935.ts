import type { ActionCall } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i6d6986eba3bd53549b85b7321c069d98 } from "./i6d6986eba3bd53549b85b7321c069d98.ts";
import { ib1271b71723d57c39b4dd36252311704 } from "./ib1271b71723d57c39b4dd36252311704.ts";

export async function i01a1851689bd7d8480acf2d1ed33f935(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "ub1271b71723d57c39b4dd36252311704": // pass --attach-cape <repo> [--ref <ref>]
			return ib1271b71723d57c39b4dd36252311704(call.gate!);
		case "u6d6986eba3bd53549b85b7321c069d98": // pass --attach-cape <cape>
			return i6d6986eba3bd53549b85b7321c069d98(call.gate!);
		default:
			throw new Error(`attach-cape has no impl for ${call.usage}`);
	}
}

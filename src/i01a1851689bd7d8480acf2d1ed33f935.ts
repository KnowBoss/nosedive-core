import type { ActionCall } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i03eb962e29f75aad981e414597379f9e } from "./i03eb962e29f75aad981e414597379f9e.ts";

export async function i01a1851689bd7d8480acf2d1ed33f935(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "u03eb962e29f75aad981e414597379f9e": // pass --don-cape <repo> [--ref <ref>]
			return i03eb962e29f75aad981e414597379f9e(call.gate!);
		default:
			throw new Error(`don-cape has no impl for ${call.usage}`);
	}
}

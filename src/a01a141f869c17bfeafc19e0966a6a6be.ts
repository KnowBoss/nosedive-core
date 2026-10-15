import type { ActionCall } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { i03d222b25de05c9bb928a9ecd5f8f5e2 } from "./i03d222b25de05c9bb928a9ecd5f8f5e2.ts";
import { i1f60d279ce5b5c2ea7d7993af96cf1d6 } from "./i1f60d279ce5b5c2ea7d7993af96cf1d6.ts";
import { i266ba59c262a57c28ca1c4b80c444f94 } from "./i266ba59c262a57c28ca1c4b80c444f94.ts";

export async function a01a141f869c17bfeafc19e0966a6a6be(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "u03d222b25de05c9bb928a9ecd5f8f5e2": // cape
			return i03d222b25de05c9bb928a9ecd5f8f5e2(call.args, call.ctx);
		case "u1f60d279ce5b5c2ea7d7993af96cf1d6": // cape <remote> [--ref <ref>]
			return i1f60d279ce5b5c2ea7d7993af96cf1d6(call.args, call.ctx);
		case "u266ba59c262a57c28ca1c4b80c444f94": // cape <name> --drop
			return i266ba59c262a57c28ca1c4b80c444f94(call.args, call.ctx);
		default:
			throw new Error(`cape has no impl for ${call.usage}`);
	}
}

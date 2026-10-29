import type { ActionCall } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i215cd99285f55f34bd2faf650f0dd586 } from "./i215cd99285f55f34bd2faf650f0dd586.ts";

export async function i01a185168bb079b8be334b6d86dba95a(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "u215cd99285f55f34bd2faf650f0dd586": // pass --detach-cape <repo>
			return i215cd99285f55f34bd2faf650f0dd586(call.gate!);
		default:
			throw new Error(`detach-cape has no impl for ${call.usage}`);
	}
}

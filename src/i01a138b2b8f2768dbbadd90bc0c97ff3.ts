import type { ActionCall } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i8d3273ee9c8859d38c6c844094b1a2cc } from "./i8d3273ee9c8859d38c6c844094b1a2cc.ts";

const REF = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z0-9][a-z0-9.-]*)$/;

export async function i01a138b2b8f2768dbbadd90bc0c97ff3(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "u8d3273ee9c8859d38c6c844094b1a2cc": {
			// test <ref>
			const ref = String(call.args.ref).toLowerCase();
			if (!REF.test(ref)) throw new Error(`not a quid or a repo name: ${String(call.args.ref)}`);
			return i8d3273ee9c8859d38c6c844094b1a2cc(ref, call.ctx);
		}
		default:
			throw new Error(`test has no impl for ${call.usage}`);
	}
}

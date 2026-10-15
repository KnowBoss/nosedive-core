import type { ActionCall } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { ib3a9291785f75547af475452dbfe0cc8 } from "./ib3a9291785f75547af475452dbfe0cc8.ts";

export async function a01a133547ea87883b6acc99ddff5d5a8(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "ub3a9291785f75547af475452dbfe0cc8": // seed [--no-capes] [--root-kind <kind>]
			return ib3a9291785f75547af475452dbfe0cc8({ noCapes: call.args.noCapes === true, rootKind: (call.args.rootKind as string | undefined) ?? "base" }, call.ctx);
		default:
			throw new Error(`seed has no impl for ${call.usage}`);
	}
}

import type { ActionCall } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i67d21a735bdd548e9d3196bcfa700155 } from "./i67d21a735bdd548e9d3196bcfa700155.ts";

export async function i01a133547ea87883b6acc99ddff5d5a8(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "u67d21a735bdd548e9d3196bcfa700155": // seed [--no-capes] [--root-kind <kind>] [--workspace]
			return i67d21a735bdd548e9d3196bcfa700155({ noCapes: call.args.noCapes === true, rootKind: (call.args.rootKind as string | undefined) ?? (call.args.workspace === true ? "base" : "root"), workspace: call.args.workspace === true }, call.ctx);
		default:
			throw new Error(`seed has no impl for ${call.usage}`);
	}
}

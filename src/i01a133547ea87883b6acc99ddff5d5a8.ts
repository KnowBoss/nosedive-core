import type { ActionCall } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { ie4a628f20d785d3a941ca681bf26e3cf } from "./ie4a628f20d785d3a941ca681bf26e3cf.ts";

export async function i01a133547ea87883b6acc99ddff5d5a8(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "ue4a628f20d785d3a941ca681bf26e3cf": // seed [--no-capes] [--root-kind <kind>] [--workspace] [--migrate] [--no-migrate]
			return ie4a628f20d785d3a941ca681bf26e3cf({ noCapes: call.args.noCapes === true, rootKind: (call.args.rootKind as string | undefined) ?? (call.args.workspace === true ? "hero" : "base"), workspace: call.args.workspace === true, migrate: call.args.migrate === true, noMigrate: call.args.noMigrate === true }, call.ctx);
		default:
			throw new Error(`seed has no impl for ${call.usage}`);
	}
}

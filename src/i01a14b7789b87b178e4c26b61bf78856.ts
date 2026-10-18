import type { ActionCall } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i9882a03d30ec5c72bcd39eef78792b05 } from "./i9882a03d30ec5c72bcd39eef78792b05.ts";

export async function i01a14b7789b87b178e4c26b61bf78856(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "u9882a03d30ec5c72bcd39eef78792b05": // pass --hydrate <repo>
			return i9882a03d30ec5c72bcd39eef78792b05(call.gate!);
		default:
			throw new Error(`hydrate has no impl for ${call.usage}`);
	}
}

import type { ActionCall } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { ie912ca03bb41549d86d709f98260400c } from "./ie912ca03bb41549d86d709f98260400c.ts";

export async function i01a138b2b8f37d3282d2274fae0f5007(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "ue912ca03bb41549d86d709f98260400c": // pass --test <cape>
			return ie912ca03bb41549d86d709f98260400c(call.gate!);
		default:
			throw new Error(`cape-tests-pass has no impl for ${call.usage}`);
	}
}

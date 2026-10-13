import type { ActionCall } from "./main.ts";
import { ib9f46af7e5b35aac8070bfca950ab744 } from "./ib9f46af7e5b35aac8070bfca950ab744.ts";

export async function a01a133547ea87883b6acc99ddff5d5a8(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "ub9f46af7e5b35aac8070bfca950ab744": // seed
			return ib9f46af7e5b35aac8070bfca950ab744(call.ctx);
		default:
			throw new Error(`seed has no impl for ${call.usage}`);
	}
}

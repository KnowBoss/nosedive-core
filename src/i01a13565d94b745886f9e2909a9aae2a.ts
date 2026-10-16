import type { ActionCall } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { idbb1d37c333c5c1c9cb6446ba7dc4fbc } from "./idbb1d37c333c5c1c9cb6446ba7dc4fbc.ts";

export async function i01a13565d94b745886f9e2909a9aae2a(call: ActionCall): Promise<void> {
	const { args, ctx } = call;
	switch (call.usage) {
		case "udbb1d37c333c5c1c9cb6446ba7dc4fbc": {
			// mint [<count>] [--ms <utcmillis>] [--ts <iso8601>]
			const count = args.count === undefined ? 1 : Number(args.count);
			if (!Number.isInteger(count) || count < 1) throw new Error(`count must be a whole number above 0: ${String(args.count)}`);
			if (args.ms !== undefined && args.ts !== undefined) throw new Error("give --ms or --ts, not both");
			const start = args.ms !== undefined ? Number(args.ms) : args.ts !== undefined ? Date.parse(String(args.ts)) : Date.now();
			if (!Number.isFinite(start) || start < 0) throw new Error(`not a time: ${String(args.ms ?? args.ts)}`);
			return idbb1d37c333c5c1c9cb6446ba7dc4fbc(count, start, ctx);
		}
		default:
			throw new Error(`mint has no impl for ${call.usage}`);
	}
}

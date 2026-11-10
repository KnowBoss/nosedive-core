import type { ActionCall } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i0ac895fb79d75e2fb42b98f6d0bf3611 } from "./i0ac895fb79d75e2fb42b98f6d0bf3611.ts";
import { i9dfd0b735ec95af1948f2b3311749c52 } from "./i9dfd0b735ec95af1948f2b3311749c52.ts";

export async function i01a1bd8370eb761d998cc4d957a14cfd(call: ActionCall): Promise<void> {
	const { args, ctx } = call;
	switch (call.usage) {
		case "u9dfd0b735ec95af1948f2b3311749c52": // dock <ref>
			return i9dfd0b735ec95af1948f2b3311749c52(String(args.ref), undefined, ctx);
		case "u0ac895fb79d75e2fb42b98f6d0bf3611": // dock <ref> --head <head>
			return i0ac895fb79d75e2fb42b98f6d0bf3611(String(args.ref), String(args.head), ctx);
		default:
			throw new Error(`dock has no impl for ${call.usage}`);
	}
}

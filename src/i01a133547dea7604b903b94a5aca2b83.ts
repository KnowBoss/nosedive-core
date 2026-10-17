import type { ActionCall } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { if4a09298430355a2a473394fbb5103f2 } from "./if4a09298430355a2a473394fbb5103f2.ts";
import { i6c9390d5a8e5583881960839391345db } from "./i6c9390d5a8e5583881960839391345db.ts";
import { i3ac641d4a9d757a48df1f1de031be120 } from "./i3ac641d4a9d757a48df1f1de031be120.ts";
import { i7820a39cffb9511493085038a7e19447 } from "./i7820a39cffb9511493085038a7e19447.ts";
import { i21be7cc759fb5c758e11cffdb2630902 } from "./i21be7cc759fb5c758e11cffdb2630902.ts";
import { i933f159845875010ad6ed3569414a651 } from "./i933f159845875010ad6ed3569414a651.ts";
import { iecbd59b3160b5626840a2de9f49fb01f } from "./iecbd59b3160b5626840a2de9f49fb01f.ts";
import { i794ab6e0060f5ede8b0148203fe6df81 } from "./i794ab6e0060f5ede8b0148203fe6df81.ts";
import { i7713e1ddd9c454948ec7f940be7ffe6f } from "./i7713e1ddd9c454948ec7f940be7ffe6f.ts";
import { i971c8e5c145b560390e48ad4702e2fa5 } from "./i971c8e5c145b560390e48ad4702e2fa5.ts";
import { i5225ca8db7b85be197b4b22ee341b5f1 } from "./i5225ca8db7b85be197b4b22ee341b5f1.ts";
import { i717f85b924b35f32b24a8cfaf9c0241f } from "./i717f85b924b35f32b24a8cfaf9c0241f.ts";
import { i4d86421616655ccebfcb884e0f35ff56 } from "./i4d86421616655ccebfcb884e0f35ff56.ts";

const QUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9.-]*$/;

export async function i01a133547dea7604b903b94a5aca2b83(call: ActionCall): Promise<void> {
	const { args, ctx } = call;
	switch (call.usage) {
		case "uf4a09298430355a2a473394fbb5103f2": // crud <quid>
			return if4a09298430355a2a473394fbb5103f2(quid(args.quid), ctx);
		case "u6c9390d5a8e5583881960839391345db": // crud <kind> <gist>... [--name <name>] [--meta <source>]
			return i6c9390d5a8e5583881960839391345db(
				{ ...repoKind(args.kind), gist: (args.gist as string[]).join(" "), name: optionalSlug(args.name), meta: args.meta as string | undefined },
				ctx,
			);
		case "u3ac641d4a9d757a48df1f1de031be120": // crud <quid> --meta <source>
			return i3ac641d4a9d757a48df1f1de031be120(quid(args.quid), String(args.meta), ctx);
		case "u7820a39cffb9511493085038a7e19447": // crud <quid> --scopes <source>
			return i7820a39cffb9511493085038a7e19447(quid(args.quid), String(args.scopes), ctx);
		case "u21be7cc759fb5c758e11cffdb2630902": // crud <quid> --links <source>
			return i21be7cc759fb5c758e11cffdb2630902(quid(args.quid), String(args.links), ctx);
		case "u933f159845875010ad6ed3569414a651": // crud <quid> --title <title>
			return i933f159845875010ad6ed3569414a651(quid(args.quid), String(args.title), ctx);
		case "uecbd59b3160b5626840a2de9f49fb01f": // crud <quid> --body <source>
			return iecbd59b3160b5626840a2de9f49fb01f(quid(args.quid), String(args.body), ctx);
		case "u794ab6e0060f5ede8b0148203fe6df81": // crud <quid> --section <heading> <source>
			return i794ab6e0060f5ede8b0148203fe6df81(quid(args.quid), String(args.section), String(args.source), ctx);
		case "u7713e1ddd9c454948ec7f940be7ffe6f": // crud <quid> --gist <gist>
			return i7713e1ddd9c454948ec7f940be7ffe6f(quid(args.quid), String(args.gist), ctx);
		case "u971c8e5c145b560390e48ad4702e2fa5": // crud <quid> --name <name>
			return i971c8e5c145b560390e48ad4702e2fa5(quid(args.quid), slug(args.name, "--name"), ctx);
		case "u5225ca8db7b85be197b4b22ee341b5f1": // crud <quid> --kind <kind>
			return i5225ca8db7b85be197b4b22ee341b5f1(quid(args.quid), slug(args.kind, "--kind"), ctx);
		case "u717f85b924b35f32b24a8cfaf9c0241f": // crud --drop <quid> [--hard]
			return i717f85b924b35f32b24a8cfaf9c0241f(quid(args.drop), args.hard === true, ctx);
		case "u4d86421616655ccebfcb884e0f35ff56": // crud --drop-list <source> [--hard]
			return i4d86421616655ccebfcb884e0f35ff56(String(args.dropList), args.hard === true, ctx);
		default:
			throw new Error(`crud has no impl for ${call.usage}`);
	}
}

function quid(value: unknown): string {
	if (!QUID.test(String(value))) throw new Error(`not a quid: ${String(value)}`);
	return String(value).toLowerCase();
}

function slug(value: unknown, what: string): string {
	if (!SLUG.test(String(value))) throw new Error(`${what} must be lowercase letters, digits, dots and dashes: ${String(value)}`);
	return String(value);
}

/** `<kind>` writes to the bridge, `<repo>:<kind>` to that repo's checkout in the workspace. */
function repoKind(value: unknown): { repo: string | undefined; kind: string } {
	const [first, second] = String(value).split(":", 2) as [string, string | undefined];
	return second === undefined ? { repo: undefined, kind: slug(first, "kind") } : { repo: slug(first, "repo"), kind: slug(second, "kind") };
}

function optionalSlug(value: unknown): string | undefined {
	return value === undefined ? undefined : slug(value, "--name");
}

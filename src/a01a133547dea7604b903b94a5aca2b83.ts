import type { ActionCall } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { if4a09298430355a2a473394fbb5103f2 } from "./if4a09298430355a2a473394fbb5103f2.ts";
import { i8a86ae5e03195d5192c64052d558b6fd } from "./i8a86ae5e03195d5192c64052d558b6fd.ts";
import { i3ac641d4a9d757a48df1f1de031be120 } from "./i3ac641d4a9d757a48df1f1de031be120.ts";
import { i7820a39cffb9511493085038a7e19447 } from "./i7820a39cffb9511493085038a7e19447.ts";
import { i21be7cc759fb5c758e11cffdb2630902 } from "./i21be7cc759fb5c758e11cffdb2630902.ts";

const QUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9.-]*$/;

export async function a01a133547dea7604b903b94a5aca2b83(call: ActionCall): Promise<void> {
	const { args, ctx } = call;
	switch (call.usage) {
		case "uf4a09298430355a2a473394fbb5103f2": // crud <quid>
			return if4a09298430355a2a473394fbb5103f2(quid(args.quid), ctx);
		case "u8a86ae5e03195d5192c64052d558b6fd": // crud <kind> <gist>... [--name <name>]
			return i8a86ae5e03195d5192c64052d558b6fd(
				{ kind: slug(args.kind, "kind"), gist: (args.gist as string[]).join(" "), name: optionalSlug(args.name) },
				ctx,
			);
		case "u3ac641d4a9d757a48df1f1de031be120": // crud <quid> --meta <source>
			return i3ac641d4a9d757a48df1f1de031be120(quid(args.quid), String(args.meta), ctx);
		case "u7820a39cffb9511493085038a7e19447": // crud <quid> --scopes <source>
			return i7820a39cffb9511493085038a7e19447(quid(args.quid), String(args.scopes), ctx);
		case "u21be7cc759fb5c758e11cffdb2630902": // crud <quid> --links <source>
			return i21be7cc759fb5c758e11cffdb2630902(quid(args.quid), String(args.links), ctx);
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

function optionalSlug(value: unknown): string | undefined {
	return value === undefined ? undefined : slug(value, "--name");
}

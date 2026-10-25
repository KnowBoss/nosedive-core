import type { ActionCall, Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335487317576a0afd03506ef5555 as readSource } from "./i01a1335487317576a0afd03506ef5555.ts";
import { i01a1471723807d6e8ef228ad9472fff7 as readText } from "./i01a1471723807d6e8ef228ad9472fff7.ts";
import { i01a14ab1d36771eea2bc6f13bdeb0526 as editKbDocs, type KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { if4a09298430355a2a473394fbb5103f2 } from "./if4a09298430355a2a473394fbb5103f2.ts";
import { ia73b03420ddb598498e19a66b144de9a } from "./ia73b03420ddb598498e19a66b144de9a.ts";
import { i3ac641d4a9d757a48df1f1de031be120 } from "./i3ac641d4a9d757a48df1f1de031be120.ts";
import { i7820a39cffb9511493085038a7e19447 } from "./i7820a39cffb9511493085038a7e19447.ts";
import { i21be7cc759fb5c758e11cffdb2630902 } from "./i21be7cc759fb5c758e11cffdb2630902.ts";
import { i112fbf4a4c7153da8d321f828607a1d0 } from "./i112fbf4a4c7153da8d321f828607a1d0.ts";
import { i933f159845875010ad6ed3569414a651 } from "./i933f159845875010ad6ed3569414a651.ts";
import { iecbd59b3160b5626840a2de9f49fb01f } from "./iecbd59b3160b5626840a2de9f49fb01f.ts";
import { i794ab6e0060f5ede8b0148203fe6df81 } from "./i794ab6e0060f5ede8b0148203fe6df81.ts";
import { ie9dc0e8d57db5875868f19e35aa40379 } from "./ie9dc0e8d57db5875868f19e35aa40379.ts";
import { i7713e1ddd9c454948ec7f940be7ffe6f } from "./i7713e1ddd9c454948ec7f940be7ffe6f.ts";
import { i971c8e5c145b560390e48ad4702e2fa5 } from "./i971c8e5c145b560390e48ad4702e2fa5.ts";
import { i5225ca8db7b85be197b4b22ee341b5f1 } from "./i5225ca8db7b85be197b4b22ee341b5f1.ts";
import { i2ad1fc06c83d538e8d38e574e99974af } from "./i2ad1fc06c83d538e8d38e574e99974af.ts";
import { i717f85b924b35f32b24a8cfaf9c0241f } from "./i717f85b924b35f32b24a8cfaf9c0241f.ts";
import { i4d86421616655ccebfcb884e0f35ff56 } from "./i4d86421616655ccebfcb884e0f35ff56.ts";

const QUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9.-]*$/;

export async function i01a133547dea7604b903b94a5aca2b83(call: ActionCall): Promise<void> {
	const { args, ctx } = call;
	switch (call.usage) {
		case "uf4a09298430355a2a473394fbb5103f2": // crud <quid>
			return if4a09298430355a2a473394fbb5103f2(quid(args.quid), ctx);
		case "ua73b03420ddb598498e19a66b144de9a": // crud <kind> <gist>... [--name <name>] [--meta <source>] [--into <path>]
			return ia73b03420ddb598498e19a66b144de9a(
				{ ...repoKind(args.kind), gist: (args.gist as string[]).join(" "), name: optionalSlug(args.name), meta: args.meta as string | undefined, into: args.into as string | undefined },
				ctx,
			);
		case "u3ac641d4a9d757a48df1f1de031be120": { // crud <quid> --meta <source>
			const patch = await readSource(String(args.meta), ctx);
			return single(ctx, (edit) => i3ac641d4a9d757a48df1f1de031be120(edit, quid(args.quid), patch, ctx));
		}
		case "u7820a39cffb9511493085038a7e19447": { // crud <quid> --scopes <source>
			const patch = await readSource(String(args.scopes), ctx);
			return single(ctx, (edit) => i7820a39cffb9511493085038a7e19447(edit, quid(args.quid), patch));
		}
		case "u21be7cc759fb5c758e11cffdb2630902": { // crud <quid> --links <source>
			const patch = await readSource(String(args.links), ctx);
			return single(ctx, (edit) => i21be7cc759fb5c758e11cffdb2630902(edit, quid(args.quid), patch));
		}
		case "u112fbf4a4c7153da8d321f828607a1d0": // crud <quid> --parent <parent>
			return single(ctx, (edit) => i112fbf4a4c7153da8d321f828607a1d0(edit, quid(args.quid), quid(args.parent)));
		case "u933f159845875010ad6ed3569414a651": // crud <quid> --title <title>
			return single(ctx, (edit) => i933f159845875010ad6ed3569414a651(edit, quid(args.quid), String(args.title)));
		case "uecbd59b3160b5626840a2de9f49fb01f": { // crud <quid> --body <source>
			const text = await readText(String(args.body), ctx);
			return single(ctx, (edit) => iecbd59b3160b5626840a2de9f49fb01f(edit, quid(args.quid), text));
		}
		case "u794ab6e0060f5ede8b0148203fe6df81": { // crud <quid> --section <heading> <source>
			const text = await readText(String(args.source), ctx);
			return single(ctx, (edit) => i794ab6e0060f5ede8b0148203fe6df81(edit, quid(args.quid), String(args.section), text));
		}
		case "ue9dc0e8d57db5875868f19e35aa40379": { // crud <quid> --replace <old> <new>
			if (args.replace === "-" && args.new === "-") throw new Error("--replace can read only one of its texts from stdin");
			const old = await readText(String(args.replace), ctx);
			const replacement = await readText(String(args.new), ctx);
			return single(ctx, (edit) => ie9dc0e8d57db5875868f19e35aa40379(edit, quid(args.quid), old, replacement));
		}
		case "u7713e1ddd9c454948ec7f940be7ffe6f": // crud <quid> --gist <gist>
			return single(ctx, (edit) => i7713e1ddd9c454948ec7f940be7ffe6f(edit, quid(args.quid), String(args.gist)));
		case "u971c8e5c145b560390e48ad4702e2fa5": // crud <quid> --name <name>
			return single(ctx, (edit) => i971c8e5c145b560390e48ad4702e2fa5(edit, quid(args.quid), String(args.name)));
		case "u5225ca8db7b85be197b4b22ee341b5f1": // crud <quid> --kind <kind>
			return single(ctx, (edit) => i5225ca8db7b85be197b4b22ee341b5f1(edit, quid(args.quid), String(args.kind), ctx));
		case "u2ad1fc06c83d538e8d38e574e99974af": // crud --batch <source>
			return i2ad1fc06c83d538e8d38e574e99974af(String(args.batch), ctx);
		case "u717f85b924b35f32b24a8cfaf9c0241f": // crud --drop <quid> [--hard]
			return i717f85b924b35f32b24a8cfaf9c0241f(quid(args.drop), args.hard === true, ctx);
		case "u4d86421616655ccebfcb884e0f35ff56": // crud --drop-list <source> [--hard]
			return i4d86421616655ccebfcb884e0f35ff56(String(args.dropList), args.hard === true, ctx);
		default:
			throw new Error(`crud has no impl for ${call.usage}`);
	}
}

/** Applies one edit and commits it. */
function single(ctx: Ctx, apply: (edit: KbEdit) => void): void {
	const edit = editKbDocs(ctx.cwd);
	apply(edit);
	ctx.out(edit.commit().join("\n"));
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

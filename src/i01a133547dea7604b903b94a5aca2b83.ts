import type { ActionCall, Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335487317576a0afd03506ef5555 as readSource } from "./i01a1335487317576a0afd03506ef5555.ts";
import { i01a1471723807d6e8ef228ad9472fff7 as readText } from "./i01a1471723807d6e8ef228ad9472fff7.ts";
import { i01a14ab1d36771eea2bc6f13bdeb0526 as editKbDocs, type KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i5d22a1166ca0519c8dcb58f8989f3ac0 } from "./i5d22a1166ca0519c8dcb58f8989f3ac0.ts";
import { if4a09298430355a2a473394fbb5103f2 } from "./if4a09298430355a2a473394fbb5103f2.ts";
import { ibccbde44f93254e0bb6a2af910bc03d9 } from "./ibccbde44f93254e0bb6a2af910bc03d9.ts";
import { ie9ce704f3ee25e028d2fbff7cd47bfc8 } from "./ie9ce704f3ee25e028d2fbff7cd47bfc8.ts";
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
import { discardMinted, gateEdit } from "./i01a1b453a16c799bb9ce20fad1a9075b.ts";
import { i4566acc2e53a5c9cb2f745468d21fa5b, keyedMeta } from "./i4566acc2e53a5c9cb2f745468d21fa5b.ts";
import { ia2855cb936b2597b8666125991f0d31a, readSections } from "./ia2855cb936b2597b8666125991f0d31a.ts";
import { i859f923b4af35dfe968bad37c2bbdfe1 } from "./i859f923b4af35dfe968bad37c2bbdfe1.ts";
import { id9fb53df0d40519da77bfe4bc92d4355 } from "./id9fb53df0d40519da77bfe4bc92d4355.ts";

const QUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LISTED = /^(?:.*[\\/])?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.md$/i;
const SLUG = /^[a-z0-9][a-z0-9.-]*$/;

export async function i01a133547dea7604b903b94a5aca2b83(call: ActionCall): Promise<void> {
	const { args, ctx } = call;
	switch (call.usage) {
		case "u5d22a1166ca0519c8dcb58f8989f3ac0": // crud
			return i5d22a1166ca0519c8dcb58f8989f3ac0(ctx);
		case "uf4a09298430355a2a473394fbb5103f2": // crud <quid>
			return if4a09298430355a2a473394fbb5103f2(quid(args.quid), ctx);
		case "ubccbde44f93254e0bb6a2af910bc03d9": // crud --read <quid>
			return ibccbde44f93254e0bb6a2af910bc03d9(quid(args.read), ctx);
		case "ue9ce704f3ee25e028d2fbff7cd47bfc8": { // crud <kind> <gist>... [--name <name>] [--meta <source>] [--meta:<path> <value>]... [--section:<path> <source>]...
			const sections = await readSections(args["section:"] as Record<string, string>, ctx, args.meta === "-" ? 1 : 0);
			return ie9ce704f3ee25e028d2fbff7cd47bfc8(
				{
					kind: capeKind(args.kind),
					gist: (args.gist as string[]).join(" "),
					name: optionalSlug(args.name),
					meta: args.meta as string | undefined,
					keyed: keyedMeta(args["meta:"] as Record<string, string>),
					sections,
				},
				ctx,
			);
		}
		case "u4566acc2e53a5c9cb2f745468d21fa5b": { // crud <quid> --meta:<path> <value>... [--section:<path> <source>]...
			const sections = await readSections(args["section:"] as Record<string, string>, ctx);
			const meta = args["meta:"] as Record<string, string>;
			return single(ctx, ["meta", ...(Object.keys(sections).length ? ["section"] : [])], (edit) => i4566acc2e53a5c9cb2f745468d21fa5b(edit, quid(args.quid), meta, sections, ctx));
		}
		case "ua2855cb936b2597b8666125991f0d31a": { // crud <quid> --section:<path> <source>...
			const sections = await readSections(args["section:"] as Record<string, string>, ctx);
			return single(ctx, "section", (edit) => ia2855cb936b2597b8666125991f0d31a(edit, quid(args.quid), sections));
		}
		case "u3ac641d4a9d757a48df1f1de031be120": { // crud <quid> --meta <source>
			const patch = await readSource(String(args.meta), ctx);
			return single(ctx, "meta", (edit) => i3ac641d4a9d757a48df1f1de031be120(edit, quid(args.quid), patch, ctx));
		}
		case "u7820a39cffb9511493085038a7e19447": { // crud <quid> --scopes <source>
			const patch = await readSource(String(args.scopes), ctx);
			return single(ctx, "scopes", (edit) => i7820a39cffb9511493085038a7e19447(edit, quid(args.quid), patch));
		}
		case "u21be7cc759fb5c758e11cffdb2630902": { // crud <quid> --links <source>
			const patch = await readSource(String(args.links), ctx);
			return single(ctx, "links", (edit) => i21be7cc759fb5c758e11cffdb2630902(edit, quid(args.quid), patch));
		}
		case "u112fbf4a4c7153da8d321f828607a1d0": // crud <quid> --parent <parent>
			return single(ctx, "parent", (edit) => i112fbf4a4c7153da8d321f828607a1d0(edit, quid(args.quid), quid(args.parent)));
		case "u933f159845875010ad6ed3569414a651": // crud <quid> --title <title>
			return single(ctx, "title", (edit) => i933f159845875010ad6ed3569414a651(edit, quid(args.quid), String(args.title)));
		case "uecbd59b3160b5626840a2de9f49fb01f": { // crud <quid> --body <source>
			const text = await readText(String(args.body), ctx);
			return single(ctx, "body", (edit) => iecbd59b3160b5626840a2de9f49fb01f(edit, quid(args.quid), text));
		}
		case "u794ab6e0060f5ede8b0148203fe6df81": { // crud <quid> --section <heading> <source>
			const text = await readText(String(args.source), ctx);
			return single(ctx, "section", (edit) => i794ab6e0060f5ede8b0148203fe6df81(edit, quid(args.quid), String(args.section), text));
		}
		case "ue9dc0e8d57db5875868f19e35aa40379": { // crud <quid> --replace <old> <new>
			if (args.replace === "-" && args.new === "-") throw new Error("--replace can read only one of its texts from stdin");
			const old = await readText(String(args.replace), ctx);
			const replacement = await readText(String(args.new), ctx);
			return single(ctx, "replace", (edit) => ie9dc0e8d57db5875868f19e35aa40379(edit, quid(args.quid), old, replacement));
		}
		case "u7713e1ddd9c454948ec7f940be7ffe6f": // crud <quid> --gist <gist>
			return single(ctx, "gist", (edit) => i7713e1ddd9c454948ec7f940be7ffe6f(edit, quid(args.quid), String(args.gist)));
		case "u971c8e5c145b560390e48ad4702e2fa5": // crud <quid> --name <name>
			return single(ctx, "name", (edit) => i971c8e5c145b560390e48ad4702e2fa5(edit, quid(args.quid), String(args.name)));
		case "u5225ca8db7b85be197b4b22ee341b5f1": // crud <quid> --kind <kind>
			return single(ctx, "kind", (edit) => i5225ca8db7b85be197b4b22ee341b5f1(edit, quid(args.quid), String(args.kind), ctx));
		case "u2ad1fc06c83d538e8d38e574e99974af": // crud --batch <source>
			return i2ad1fc06c83d538e8d38e574e99974af(String(args.batch), ctx);
		case "u717f85b924b35f32b24a8cfaf9c0241f": // crud --drop <quid> [--hard]
			return i717f85b924b35f32b24a8cfaf9c0241f(quid(args.drop), args.hard === true, ctx);
		case "u859f923b4af35dfe968bad37c2bbdfe1": // crud --drop <quid> --sure [--hard]
			return i859f923b4af35dfe968bad37c2bbdfe1(quid(args.drop), args.hard === true, ctx);
		case "u4d86421616655ccebfcb884e0f35ff56": // crud --drop-list <source> [--hard]
			return i4d86421616655ccebfcb884e0f35ff56(String(args.dropList), args.hard === true, ctx);
		case "ud9fb53df0d40519da77bfe4bc92d4355": // crud --drop-list <source> --sure [--hard]
			return id9fb53df0d40519da77bfe4bc92d4355(String(args.dropList), args.hard === true, ctx);
		default:
			throw new Error(`crud has no impl for ${call.usage}`);
	}
}

/** Applies one edit, named as its flag, runs the crud gates of what it touched, and commits it all (see crud-gates). */
async function single(ctx: Ctx, name: string | string[], apply: (edit: KbEdit) => void): Promise<void> {
	const edit = editKbDocs(ctx.cwd, ctx.capes[0]!.version, ctx.capes, (warning) => ctx.err(`nosedive: ${warning}`));
	apply(edit);
	edit.edits.push(...[name].flat());
	const discard: string[] = [];
	try {
		await gateEdit(edit, ctx, [], discard);
		ctx.out(edit.commit().join("\n"));
	} catch (error) {
		discardMinted(discard);
		throw error;
	}
}

/** A quid, or a doc's path ending `<quid>.md`, as `next` prints it (listed-paths-accepted). */
function quid(value: unknown): string {
	const id = String(value).replace(LISTED, "$1");
	if (!QUID.test(id)) throw new Error(`not a quid: ${String(value)} (give a quid, or a path ending <quid>.md)`);
	return id.toLowerCase();
}

function slug(value: unknown, what: string): string {
	if (!SLUG.test(String(value))) throw new Error(`${what} must be lowercase letters, digits, dots and dashes: ${String(value)}`);
	return String(value);
}

/** `<cape>:<kind>` names whose kind; the cape's name is checked by find-kind. */
function capeKind(value: unknown): string {
	const [first, second] = String(value).split(":", 2) as [string, string | undefined];
	return second === undefined ? slug(first, "kind") : `${slug(first, "cape")}:${slug(second, "kind")}`;
}

function optionalSlug(value: unknown): string | undefined {
	return value === undefined ? undefined : slug(value, "--name");
}

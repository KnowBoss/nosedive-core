import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335487317576a0afd03506ef5555 as readSource } from "./i01a1335487317576a0afd03506ef5555.ts";
import { i01a14ab1d36771eea2bc6f13bdeb0526 as editKbDocs, type KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i3ac641d4a9d757a48df1f1de031be120 as editMeta } from "./i3ac641d4a9d757a48df1f1de031be120.ts";
import { i7820a39cffb9511493085038a7e19447 as editScopes } from "./i7820a39cffb9511493085038a7e19447.ts";
import { i21be7cc759fb5c758e11cffdb2630902 as editLinks } from "./i21be7cc759fb5c758e11cffdb2630902.ts";
import { i112fbf4a4c7153da8d321f828607a1d0 as editParent } from "./i112fbf4a4c7153da8d321f828607a1d0.ts";
import { i933f159845875010ad6ed3569414a651 as editTitle } from "./i933f159845875010ad6ed3569414a651.ts";
import { iecbd59b3160b5626840a2de9f49fb01f as editBody } from "./iecbd59b3160b5626840a2de9f49fb01f.ts";
import { i794ab6e0060f5ede8b0148203fe6df81 as editSection } from "./i794ab6e0060f5ede8b0148203fe6df81.ts";
import { ie9dc0e8d57db5875868f19e35aa40379 as editReplace } from "./ie9dc0e8d57db5875868f19e35aa40379.ts";
import { i7713e1ddd9c454948ec7f940be7ffe6f as editGist } from "./i7713e1ddd9c454948ec7f940be7ffe6f.ts";
import { i971c8e5c145b560390e48ad4702e2fa5 as editName } from "./i971c8e5c145b560390e48ad4702e2fa5.ts";
import { i5225ca8db7b85be197b4b22ee341b5f1 as editKind } from "./i5225ca8db7b85be197b4b22ee341b5f1.ts";

const QUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EDITS: Record<string, (edit: KbEdit, quid: string, value: unknown, ctx: Ctx) => void> = {
	meta: (edit, quid, value, ctx) => editMeta(edit, quid, value, ctx),
	scopes: (edit, quid, value) => editScopes(edit, quid, value),
	links: (edit, quid, value) => editLinks(edit, quid, value),
	parent: (edit, quid, value) => editParent(edit, quid, quidOf(value, "parent")),
	title: (edit, quid, value) => editTitle(edit, quid, text(value, "title")),
	body: (edit, quid, value) => editBody(edit, quid, text(value, "body")),
	section: (edit, quid, value) => {
		const { heading, text: content } = fields(value, "section", ["heading", "text"]);
		editSection(edit, quid, text(heading, "section heading"), text(content, "section text"));
	},
	replace: (edit, quid, value) => {
		const { old, new: replacement } = fields(value, "replace", ["old", "new"]);
		editReplace(edit, quid, text(old, "replace old"), text(replacement, "replace new"));
	},
	gist: (edit, quid, value) => editGist(edit, quid, text(value, "gist")),
	name: (edit, quid, value) => editName(edit, quid, text(value, "name")),
	kind: (edit, quid, value, ctx) => editKind(edit, quid, text(value, "kind"), ctx),
};

export async function i2ad1fc06c83d538e8d38e574e99974af(source: string, ctx: Ctx): Promise<void> {
	const items = await readSource(source, ctx);
	if (!Array.isArray(items) || items.length === 0) throw new Error("--batch takes a list of edits");
	const edit = editKbDocs(ctx.cwd);
	items.forEach((item, index) => {
		const where = `--batch item ${index + 1}`;
		if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${where} is not a mapping`);
		const { quid, ...rest } = item as Record<string, unknown>;
		const keys = Object.keys(rest);
		if (keys.length !== 1 || !EDITS[keys[0]!]) throw new Error(`${where} takes a quid and one of ${Object.keys(EDITS).join(", ")}`);
		try {
			EDITS[keys[0]!]!(edit, quidOf(quid, "quid"), rest[keys[0]!], ctx);
		} catch (error) {
			throw new Error(`${where}: ${(error as Error).message}`);
		}
	});
	ctx.out(edit.commit().join("\n"));
}

function quidOf(value: unknown, what: string): string {
	if (!QUID.test(String(value))) throw new Error(`${what} is not a quid: ${String(value)}`);
	return String(value).toLowerCase();
}

function text(value: unknown, what: string): string {
	if (typeof value !== "string") throw new Error(`${what} takes text`);
	return value;
}

function fields(value: unknown, what: string, names: string[]): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${what} takes ${names.join(" and ")}`);
	return value as Record<string, unknown>;
}

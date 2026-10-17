import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
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

/** `key` is the edit's flag without its dashes, and `value` what the flag takes, inline. */
export function i01a14b30ecc07ea18999d6255d636e39(edit: KbEdit, quid: unknown, key: string, value: unknown, ctx: Ctx): void {
	const apply = EDITS[key];
	if (!apply) throw new Error(`no crud edit ${key}: the edits are ${Object.keys(EDITS).join(", ")}`);
	apply(edit, quidOf(quid, "quid"), value, ctx);
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

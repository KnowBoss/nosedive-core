import type { GateCtx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a15baf13e27bd88dc880d4871f2210 as hydrateRepo } from "./i01a15baf13e27bd88dc880d4871f2210.ts";

const ROLES = ["ship", "cape", "base"];

export async function i413facba4ec6596291333591aab5b760(ctx: GateCtx): Promise<void> {
	const name = String(ctx.doc.fm.name);
	const { dir } = hydrateRepo(ctx.bridge, ctx.doc, { out: (text) => (/checked out already$/.test(text) ? undefined : ctx.out(text)), err: ctx.err });
	const own = readRepoConfig(dir);
	const key = ROLES.find((role) => typeof own?.config[role] === "string");
	const kind = own?.root ? findKbDoc(own.kbDir, own.root)?.fm.kind : undefined;
	// An older config names its root as root or backlog; then the root's kind says, a base with a workspace being a ship.
	const says = key ?? (own?.workspace !== undefined ? "ship" : ROLES.includes(String(kind)) ? String(kind) : "misc");
	const role = (ctx.doc.fm.meta as { role?: unknown } | undefined)?.role;
	ctx.out(`${name}: its doc says ${typeof role === "string" ? role : "nothing"}, it says ${says}${own?.root ? ` (root ${own.root})` : own ? "" : " (no nosedive config)"}`);
	if (typeof role !== "string") throw new Error(`${name}'s doc has no role: \`nosedive crud ${ctx.doc.id} --meta -\` with \`role: ${says}\` sets it`);
	if (role !== says) throw new Error(`${name}'s doc says ${role}, but it is a ${says}`);
}

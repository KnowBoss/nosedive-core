import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parse } from "yaml";
import type { GateCtx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { ROOT_KEYS } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a13c760de87562b4738946402010b8 as checkoutPath } from "./i01a13c760de87562b4738946402010b8.ts";
import { fetchCache } from "./i01a15baf13e27bd88dc880d4871f2210.ts";

const ROLES = ["hero", "cape", "base"];

export async function i413facba4ec6596291333591aab5b760(ctx: GateCtx): Promise<void> {
	const name = String(ctx.doc.fm.name);
	// Our checkout is the copy nosedive acts on; with none, the cache's trunk, fetched, never a new checkout.
	const dir = checkoutPath(ctx.bridge, name);
	let read: (path: string) => string | undefined;
	let from: string;
	if (existsSync(dir)) {
		read = (path) => (existsSync(join(dir, path)) ? readFileSync(join(dir, path), "utf8") : undefined);
		from = `the checkout ${relative(ctx.bridge.dir, dir).replace(/\\/g, "/")}`;
	} else {
		const { cache, trunk } = fetchCache(ctx.bridge, ctx.doc, ctx);
		const tip = `refs/remotes/origin/${trunk}`;
		read = (path) => git(cache, "show", `${tip}:${path}`);
		from = `${trunk} at ${git(cache, "rev-parse", "--short", tip)} in the cache`;
	}
	// A repo is what its config enables: a cape root makes a cape, a workspace a hero repo, roots alone a base.
	const text = read(".nosedive/config.yaml");
	const config = text === undefined ? undefined : ((parse(text) ?? {}) as Record<string, unknown>);
	const roots = Array.isArray(config?.roots) ? config.roots.filter((path): path is string => typeof path === "string") : undefined;
	let root: string | undefined;
	let says: string;
	if (roots) {
		root = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.md$/i.exec(roots[0] ?? "")?.[1];
		const kinds = roots.map((path) => {
			const doc = read(path.replace(/^\.\//, ""));
			return doc === undefined ? undefined : readKbDoc(doc).fm.kind;
		});
		says = kinds.includes("cape") ? "cape" : typeof config?.workspace === "string" ? "hero" : roots.length > 0 ? "base" : "misc";
	} else {
		root = ROOT_KEYS.map((each) => config?.[each]).find((value): value is string => typeof value === "string");
		says = typeof config?.ship === "string" ? "hero" : (ROLES.find((role) => typeof config?.[role] === "string") ?? legacyRole(read, config, root));
	}
	const role = (ctx.doc.fm.meta as { role?: unknown } | undefined)?.role;
	ctx.out(`${name}: its doc says ${typeof role === "string" ? role : "nothing"}, it says ${says} (${root ? `root ${root}, ` : config ? "" : "no nosedive config, "}read from ${from})`);
	if (typeof role !== "string") throw new Error(`${name}'s doc has no role: \`nosedive crud ${ctx.doc.id} --meta -\` with \`role: ${says}\` sets it`);
	if (role !== says) throw new Error(`${name}'s doc says ${role}, but it is a ${says}`);
}

/** An older config names its root as root or backlog: then the root's kind says, a ship root or a base with a workspace being a hero. */
function legacyRole(read: (path: string) => string | undefined, config: Record<string, unknown> | undefined, root: string | undefined): string {
	if (!config || !root) return "misc";
	const kb = (typeof config.kb === "string" ? config.kb : "kb").replace(/^\.\//, "").replace(/\/$/, "");
	const text = read(`${kb}/${root}.md`);
	if (text === undefined) return "misc";
	const fm = readKbDoc(text).fm;
	if (fm.kind === "ship" || (fm.kind === "base" && typeof (fm.meta as { workspace?: unknown } | undefined)?.workspace === "string")) return "hero";
	return ROLES.includes(String(fm.kind)) ? String(fm.kind) : "misc";
}

function git(cwd: string, ...args: string[]): string | undefined {
	const result = spawnSync("git", args, { cwd, encoding: "utf8" });
	return result.status === 0 ? result.stdout.trim() : undefined;
}

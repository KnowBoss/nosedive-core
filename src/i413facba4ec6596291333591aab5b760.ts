import { spawnSync } from "node:child_process";
import { parse } from "yaml";
import type { GateCtx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { ROOT_KEYS } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a15baf13e27bd88dc880d4871f2210 as hydrateRepo } from "./i01a15baf13e27bd88dc880d4871f2210.ts";

const ROLES = ["ship", "cape", "base"];

export async function i413facba4ec6596291333591aab5b760(ctx: GateCtx): Promise<void> {
	const name = String(ctx.doc.fm.name);
	const { dir, trunk } = hydrateRepo(ctx.bridge, ctx.doc, { out: (text) => (/checked out already$/.test(text) ? undefined : ctx.out(text)), err: ctx.err });
	// The trunk as the remote has it now: a checkout may be behind, or mid-dive.
	const fetched = git(dir, "fetch", "-q", "origin");
	if (fetched === undefined) ctx.err(`nosedive: cannot fetch ${name}, so its last fetched ${trunk} is read`);
	const tip = `refs/remotes/origin/${trunk}`;
	const at = git(dir, "rev-parse", "--short", tip);
	const text = git(dir, "show", `${tip}:.nosedive/config.yaml`);
	const config = text === undefined ? undefined : ((parse(text) ?? {}) as Record<string, unknown>);
	const key = ROLES.find((role) => typeof config?.[role] === "string");
	const root = ROOT_KEYS.map((each) => config?.[each]).find((value): value is string => typeof value === "string");
	const says = key ?? legacyRole(dir, tip, config, root);
	const role = (ctx.doc.fm.meta as { role?: unknown } | undefined)?.role;
	ctx.out(`${name}: its doc says ${typeof role === "string" ? role : "nothing"}, it says ${says} (${root ? `root ${root}, ` : config ? "" : "no nosedive config, "}${trunk} at ${at})`);
	if (typeof role !== "string") throw new Error(`${name}'s doc has no role: \`nosedive crud ${ctx.doc.id} --meta -\` with \`role: ${says}\` sets it`);
	if (role !== says) throw new Error(`${name}'s doc says ${role}, but it is a ${says}`);
}

/** An older config names its root as root or backlog: then the root's kind says, a base with a workspace being a ship. */
function legacyRole(dir: string, tip: string, config: Record<string, unknown> | undefined, root: string | undefined): string {
	if (!config || !root) return "misc";
	const kb = (typeof config.kb === "string" ? config.kb : "kb").replace(/^\.\//, "").replace(/\/$/, "");
	const text = git(dir, "show", `${tip}:${kb}/${root}.md`);
	if (text === undefined) return "misc";
	const fm = readKbDoc(text).fm;
	if (fm.kind === "base" && typeof (fm.meta as { workspace?: unknown } | undefined)?.workspace === "string") return "ship";
	return ROLES.includes(String(fm.kind)) ? String(fm.kind) : "misc";
}

function git(cwd: string, ...args: string[]): string | undefined {
	const result = spawnSync("git", args, { cwd, encoding: "utf8" });
	return result.status === 0 ? result.stdout.trim() : undefined;
}

import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1335487317576a0afd03506ef5555 as readSource } from "./i01a1335487317576a0afd03506ef5555.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { i01a138b2b8ed775297973c2aad478c8f as workspaceRepo } from "./i01a138b2b8ed775297973c2aad478c8f.ts";
import { i01a138b2b8ef7e8097e19d599ba39bcc as checkMeta } from "./i01a138b2b8ef7e8097e19d599ba39bcc.ts";
import { i01a141f869c07c4da8288927a559c8ae as mintKbDoc } from "./i01a141f869c07c4da8288927a559c8ae.ts";
import { i01a14ac0044f7142a4623b2b7eff2eb5 as homeCopy } from "./i01a14ac0044f7142a4623b2b7eff2eb5.ts";

export async function ia73b03420ddb598498e19a66b144de9a(
	doc: { repo: string | undefined; kind: string; gist: string; name: string | undefined; meta: string | undefined; into?: string },
	ctx: Ctx,
): Promise<void> {
	const bridge = findBridge(ctx.cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const target = doc.repo ? workspaceRepo(bridge, doc.repo) : { dir: bridge.dir, kbDir: intoTarget(bridge, doc.kind, doc.into) };
	const meta = doc.meta === undefined ? {} : await readSource(doc.meta, ctx);
	if (meta === null || typeof meta !== "object" || Array.isArray(meta)) throw new Error("--meta takes a mapping");
	const warning = checkMeta(doc.kind, meta, [target.kbDir, bridge.kbDir], ctx.capes, bridge);
	if (warning) ctx.err(`nosedive: ${warning}`);

	// A repo the bridge mints is one it owns, so it gets a home copy; with no home, one with a remote is only registered.
	let home: string | undefined;
	const remotes = ((meta as { remotes?: Record<string, unknown> }).remotes ?? {}) as Record<string, unknown>;
	const other = Object.values(remotes).find((value) => typeof value === "string") as string | undefined;
	if (doc.kind === "repo" && !doc.repo) {
		if (!doc.name) throw new Error("a repo needs --name, which names its checkout and its home copy");
		home = homeCopy(bridge, doc.name);
		if (!home && !other) throw new Error(`a repo needs a home or a remote: set \`home\` in ${relative(bridge.dir, bridge.configPath).replace(/\\/g, "/")} to where this bridge's repos live, or give meta.remotes`);
	}
	if (home) {
		if (!existsSync(dirname(home))) throw new Error(`cannot reach the home ${dirname(home)}, so no repo was created`);
		if (existsSync(home)) throw new Error(`${home} already exists`);
		const source = other && !/^[a-z][a-z0-9+.-]*:\/\/|^git@/i.test(other) && !isAbsolute(other) ? resolve(bridge.dir, other) : other;
		const created = spawnSync("git", source ? ["clone", "-q", "--mirror", source, home] : ["init", "-q", "--bare", home], { encoding: "utf8" });
		if (created.status !== 0) throw new Error(`cannot create ${home}: ${(created.stderr || created.stdout).trim()}`);
	}
	try {
		const minted = mintKbDoc(target.kbDir, { kind: doc.kind, gist: doc.gist, name: doc.name, meta: meta as Record<string, unknown> });
		commitFiles(target.dir, [minted.path], `crud(${minted.id}): created ${doc.kind} ${minted.name}`);
		ctx.out(relative(bridge.dir, minted.path).replace(/\\/g, "/"));
		if (home) ctx.out(`home copy ${home.replace(/\\/g, "/")}`);
	} catch (error) {
		if (home) rmSync(home, { recursive: true, force: true });
		throw error;
	}
}

/**
 * Where the bridge mints a doc: kinds and repos where it keeps them, anything else in the directory of the root
 * `--into` names, else of its only root.
 */
function intoTarget(bridge: Bridge, kind: string, into: string | undefined): string {
	const rel = (dir: string) => relative(bridge.dir, dir).replace(/\\/g, "/");
	if (into !== undefined) {
		const at = resolve(bridge.dir, into);
		const named = bridge.roots.find((root) => root.path === at || root.dir === at);
		if (!named) throw new Error(`${into} is no root of this repo; its roots: ${bridge.roots.map((root) => rel(root.path)).join(", ")}`);
		return named.dir;
	}
	if (kind === "kind" && bridge.kindsDir) return bridge.kindsDir;
	if (kind === "repo" && bridge.reposDir) return bridge.reposDir;
	if (bridge.roots.length > 1) throw new Error(`this repo has ${bridge.roots.length} roots: name one with --into <path>, one of ${bridge.roots.map((root) => rel(root.path)).join(", ")}`);
	return bridge.kbDir;
}

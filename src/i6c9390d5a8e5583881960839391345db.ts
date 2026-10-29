import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1335487317576a0afd03506ef5555 as readSource } from "./i01a1335487317576a0afd03506ef5555.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { i01a138b2b8ed775297973c2aad478c8f as workspaceRepo } from "./i01a138b2b8ed775297973c2aad478c8f.ts";
import { i01a138b2b8ef7e8097e19d599ba39bcc as checkMeta } from "./i01a138b2b8ef7e8097e19d599ba39bcc.ts";
import { i01a141f869c07c4da8288927a559c8ae as mintKbDoc } from "./i01a141f869c07c4da8288927a559c8ae.ts";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./i01a13354850c7ba3ba5b8ac41a7b6b11.ts";

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

	if (doc.kind === "repo") checkRepo(bridge, target.kbDir, doc.name, meta as Record<string, unknown>);
	const minted = mintKbDoc(target.kbDir, { kind: doc.kind, gist: doc.gist, name: doc.name, meta: meta as Record<string, unknown> });
	commitFiles(target.dir, [minted.path], `crud(${minted.id}): created ${doc.kind} ${minted.name}`);
	ctx.out(relative(bridge.dir, minted.path).replace(/\\/g, "/"));
}

/** A repo is written only with a name unique where it goes, and an origin git reaches. */
function checkRepo(bridge: Bridge, kbDir: string, name: string | undefined, meta: Record<string, unknown>): void {
	if (!name) throw new Error("a repo needs --name, which names its checkout");
	const dirs = kbDir === bridge.reposDir ? [kbDir, ...bridge.roots.map((root) => root.dir)] : [kbDir];
	if (dirs.filter((dir) => existsSync(dir)).flatMap((dir) => listKbDocs(dir)).some((doc) => doc.fm.kind === "repo" && doc.fm.name === name)) throw new Error(`a repo named ${name} is registered already`);
	const origin = ((meta.remotes ?? {}) as Record<string, unknown>).origin;
	if (typeof origin !== "string" || !origin) throw new Error("a repo needs meta.remotes.origin, where its checkouts fetch from and push to");
	const url = /^[a-z][a-z0-9+.-]*:\/\/|^git@/i.test(origin) || isAbsolute(origin) ? origin : resolve(bridge.dir, origin);
	const reached = spawnSync("git", ["ls-remote", "-q", url, "HEAD"], { encoding: "utf8", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
	if (reached.status !== 0) throw new Error(`cannot reach ${origin}, so no repo was registered: ${(reached.stderr || reached.stdout).trim()}`);
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

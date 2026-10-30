import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1335487317576a0afd03506ef5555 as readSource } from "./i01a1335487317576a0afd03506ef5555.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { assertPublished, i01a147171f057d019118aaa1f269f5fd as findKind, undeclaredKind, unknownKind } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { i01a18e2a3b4b798d98068d4778a158e6 as docKind } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";
import { i01a138b2b8ef7e8097e19d599ba39bcc as checkMeta } from "./i01a138b2b8ef7e8097e19d599ba39bcc.ts";
import { i01a141f869c07c4da8288927a559c8ae as mintKbDoc } from "./i01a141f869c07c4da8288927a559c8ae.ts";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./i01a13354850c7ba3ba5b8ac41a7b6b11.ts";

const KIND_OF_KINDS = "01a138b2-b8e9-7f63-9068-f1439b9cb8c9";
const REPO_KIND = "01a138b2-b8eb-79e8-9d77-6e8379ec18e3";

export async function i6c9390d5a8e5583881960839391345db(
	doc: { kind: string; gist: string; name: string | undefined; meta: string | undefined },
	ctx: Ctx,
): Promise<void> {
	const bridge = findBridge(ctx.cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const meta = doc.meta === undefined ? {} : await readSource(doc.meta, ctx);
	if (meta === null || typeof meta !== "object" || Array.isArray(meta)) throw new Error("--meta takes a mapping");
	const kind = findKind(doc.kind, bridge, ctx.capes);
	if (!kind) throw doc.kind.includes(":") ? unknownKind(doc.kind, bridge, ctx.capes) : undeclaredKind(doc.kind, bridge, ctx.capes);
	if (kind.id === KIND_OF_KINDS && doc.name === "kind") throw new Error("only core declares the kind named kind");
	const kbDir = targetDir(bridge, kind.id);
	const warning = checkMeta(doc.kind, meta, bridge, ctx.capes);
	if (warning) ctx.err(`nosedive: ${warning}`);

	if (kind.id === REPO_KIND) checkRepo(bridge, kbDir, doc.name, meta as Record<string, unknown>);
	// The repo holding the doc says whose kind is its own; any other kind is named by a canonical scope.
	const holder = docKind({ fm: { kind: kind.name }, path: join(kbDir, "doc.md") }).owner;
	const scopes = kind.owner !== holder ? [{ [kind.owner]: { canonical: true, version: assertPublished(kind, bridge) } }] : undefined;
	const minted = mintKbDoc(kbDir, { kind: kind.name, gist: doc.gist, name: doc.name, meta: meta as Record<string, unknown>, scopes });
	// git finds the repo holding the doc from its directory, a checkout's included.
	commitFiles(kbDir, [minted.path], `crud(${minted.id}): created ${doc.kind} ${minted.name}`);
	ctx.out(relative(bridge.dir, minted.path).replace(/\\/g, "/"));
}

/** A repo is written only with a name unique where it goes, and an origin git reaches. */
function checkRepo(bridge: Bridge, kbDir: string, name: string | undefined, meta: Record<string, unknown>): void {
	if (!name) throw new Error("a repo needs --name, which names its checkout");
	if (existsSync(kbDir) && listKbDocs(kbDir).some((doc) => doc.fm.name === name)) throw new Error(`a repo named ${name} is registered already`);
	const origin = ((meta.remotes ?? {}) as Record<string, unknown>).origin;
	if (typeof origin !== "string" || !origin) throw new Error("a repo needs meta.remotes.origin, where its checkouts fetch from and push to");
	const url = /^[a-z][a-z0-9+.-]*:\/\/|^git@/i.test(origin) || isAbsolute(origin) ? origin : resolve(bridge.dir, origin);
	const reached = spawnSync("git", ["ls-remote", "-q", url, "HEAD"], { encoding: "utf8", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
	if (reached.status !== 0) throw new Error(`cannot reach ${origin}, so no repo was registered: ${(reached.stderr || reached.stdout).trim()}`);
}

/** Core's own kinds and repos go where the hero reads them; any other doc goes in the selected base. */
function targetDir(bridge: Bridge, kindId: string | undefined): string {
	const managed = kindId === KIND_OF_KINDS ? bridge.kindsDir : kindId === REPO_KIND ? bridge.reposDir : undefined;
	if (!managed) return bridge.baseDir;
	if (process.env.NOSEDIVE_BASE) throw new Error(`core's ${kindId === REPO_KIND ? "repos" : "kinds"} live in ${relative(bridge.dir, managed).replace(/\\/g, "/")}, where the hero reads them, whatever base is selected: drop --base`);
	return managed;
}

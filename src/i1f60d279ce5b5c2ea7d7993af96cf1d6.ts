import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { parseDocument } from "yaml";
import type { Args, Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "./i01a1335480c776ba8945020d0af333eb.ts";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1337c81b57799820f96a757b791d0 as buildCape } from "./i01a1337c81b57799820f96a757b791d0.ts";
import { i01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./i01a1337d2c14754f9772dc22c1f2edfc.ts";
import { i01a13a6aba3a763595bd67a4ee4d47bf as findRoot } from "./i01a13a6aba3a763595bd67a4ee4d47bf.ts";
import { i01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
import { i01a141f869c07c4da8288927a559c8ae as mintKbDoc } from "./i01a141f869c07c4da8288927a559c8ae.ts";

export async function i1f60d279ce5b5c2ea7d7993af96cf1d6(args: Args, ctx: Ctx): Promise<void> {
	const bridge = findBridge(ctx.cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const core = ctx.capes[0]!;
	const given = String(args.remote);
	const remote = /^[a-z][a-z0-9+.-]*:\/\/|^git@/i.test(given) || isAbsolute(given) ? given : resolve(ctx.cwd, given);
	const ref = typeof args.ref === "string" ? args.ref : "";

	// Cloned where build-cape keeps its sources, so the build reuses it.
	const id = mintUuid();
	const dir = join(bridge.dir, ".nosedive", "capes", "src", id);
	const clone = spawnSync("git", ["clone", "-q", remote, dir], { encoding: "utf8" });
	if (clone.status !== 0) throw new Error(`cannot clone ${given}: ${(clone.stderr || clone.stdout).trim()}`);
	const root = findRoot(dir, "cape") ?? findRoot(dir);
	const name = String(root?.fm.name);
	let existing: { id: string; remote: string } | undefined;
	try {
		existing = findRepoDoc(bridge, name);
	} catch {
		existing = undefined;
	}
	if (root?.kind !== "cape" || existing) rmSync(dir, { recursive: true, force: true });
	if (root?.kind !== "cape") throw new Error(`${given} is not a cape: ${root ? `its root is a ${root.kind}` : "it has no root"}`);
	if (existing && existing.remote !== remote) throw new Error(`a repo named ${name} is already registered, cloned from ${existing.remote}`);
	const configured = configuredCapes(bridge, core);
	if (configured.some((cape) => cape.name === name)) throw new Error(`${name} is already in config \`capes\``);

	const built = await buildCape(bridge, { id: existing?.id ?? id, name, remote }, ref, core);

	const changed = [bridge.configPath];
	if (!existing) {
		changed.push(mintKbDoc(bridge.reposDir ?? bridge.kbDir, { kind: "repo", id, name, gist: `The ${name} cape`, meta: { remotes: { origin: remote } } }).path);
	}
	const spec = ref ? `${name}@${ref}` : name;
	const config = parseDocument(existsSync(bridge.configPath) ? readFileSync(bridge.configPath, "utf8") : "");
	config.set("capes", [...configured.map((cape) => cape.spec), spec]);
	writeFileSync(bridge.configPath, config.toString({ lineWidth: 0 }));
	commitFiles(bridge.dir, changed, `cape: added ${spec}`);
	ctx.out(`added cape ${spec} ${built.version} (${built.commit.slice(0, 7)})`);
	for (const [action, gist] of Object.entries(built.actions)) ctx.out(`  ${action}  ${gist}`);
}

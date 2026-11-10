import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Document, isSeq, parseDocument } from "yaml";
import { renderActions, type Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a19f5c60f879c28541aa6759d2b221 as writeAgentSurface, hasSurface, ownChange } from "./i01a19f5c60f879c28541aa6759d2b221.ts";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { nestedRoot } from "./i01a1934563e77ed886f06d04416385ef.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./i01a1337d2c14754f9772dc22c1f2edfc.ts";
import { i01a1337c81b57799820f96a757b791d0 as buildCape } from "./i01a1337c81b57799820f96a757b791d0.ts";
import { pinOf } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { CORE_OWNER } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a141f869c07c4da8288927a559c8ae as mintKbDoc } from "./i01a141f869c07c4da8288927a559c8ae.ts";
import { i01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
import { i01a1337c810a7456876b831d0c873396 as capeManifest } from "./i01a1337c810a7456876b831d0c873396.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig, selectRoot } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a175dbf4517dafa3a9048ecd98ab84 as runMigrations, MIGRATIONS, pendingMigrations, type Migration } from "./i01a175dbf4517dafa3a9048ecd98ab84.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a13a6aba3a763595bd67a4ee4d47bf as findRoot } from "./i01a13a6aba3a763595bd67a4ee4d47bf.ts";
import { i01a14a5504467ef08586b828ebabc148 as renderTree, rendersTree } from "./i01a14a5504467ef08586b828ebabc148.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "./i01a1335483aa776cb84df698b04adc06.ts";
import { i01a1b30d4b537775a4e1260cd7fb9067 as runCapeMigrations, pendingCapeMigrations } from "./i01a1b30d4b537775a4e1260cd7fb9067.ts";
import { i01a133547f5f7c45a3fb2ac0e3a7678e as scaffoldCape } from "./i01a133547f5f7c45a3fb2ac0e3a7678e.ts";

/** Relative to .nosedive/: built capes, and what this checkout remembers for itself. */
const NOSEDIVE_IGNORES = ["cache/", "capes/", "local/"];
const LOCKFILE = "!package-lock.json";

/**
 * Makes the hero's workspace, which ignores everything in it, itself included, so nothing checked
 * out there is ever committed. A workspace whose path changed since the last seed is moved, clones
 * and all, rather than left behind.
 */
function placeWorkspace(dir: string, workspace: string): void {
	const record = join(dir, ".nosedive", "local", "workspace");
	const previous = existsSync(record) ? resolve(dir, readFileSync(record, "utf8").trim()) : undefined;
	if (previous && previous !== workspace && existsSync(previous) && !existsSync(workspace)) {
		mkdirSync(dirname(workspace), { recursive: true });
		renameSync(previous, workspace);
	}
	mkdirSync(workspace, { recursive: true });
	if (!existsSync(join(workspace, ".gitignore"))) writeFileSync(join(workspace, ".gitignore"), "*\n");
	mkdirSync(dirname(record), { recursive: true });
	writeFileSync(record, `${relative(dir, workspace).replace(/\\/g, "/")}\n`);
}

/** The directory `--at` seeds as a local cape of the hero, made when it is not there, and whether the hero's config lists its root yet. */
function localCapeDir(cwd: string, at: string): { dir: string; hero: Bridge } {
	const hero = findBridge(cwd);
	const refuse = (why: string) => new Error(`seed --at ${at}: ${why}`);
	if (!hero) throw refuse("this is no hero to hold a cape");
	if (selectRoot(hero.roots, at)) throw refuse("that names one of the hero's roots, which is seeded already");
	const dir = resolve(cwd, at);
	const inside = (parent: string, path: string) => !relative(parent, path).startsWith("..") && !isAbsolute(relative(parent, path)) && relative(parent, path) !== "";
	if (!inside(hero.dir, dir)) throw refuse("a local cape lies inside the hero");
	if (hero.workspace !== undefined && (dir === hero.workspace || inside(hero.workspace, dir))) throw refuse("a local cape lies outside the hero's workspace");
	if (dir === join(hero.dir, ".nosedive") || inside(join(hero.dir, ".nosedive"), dir)) throw refuse("a local cape lies outside .nosedive");
	const seeded = existsSync(join(dir, ".nosedive", "config.yaml"));
	for (const root of hero.roots) {
		if (dir === root.dir || inside(root.dir, dir)) throw refuse(`that lies inside the directory of a root, ${root.dir}`);
		if (!seeded && inside(dir, root.dir)) throw refuse(`that holds the directory of a root, ${root.dir}`);
	}
	// The nearest repo above it must be the hero: a nested repo or another cape holds what lies in it.
	const above = dirname(dir);
	const holder = findBridge(above);
	if (!holder || relative(holder.dir, hero.dir) !== "") throw refuse(`that lies inside ${holder?.dir ?? "another repo"}, which is seeded on its own`);
	if (!seeded) {
		mkdirSync(dir, { recursive: true });
		return { dir, hero };
	}
	const own = readRepoConfig(dir);
	if (!own?.root) throw refuse("that directory is seeded but has no root");
	if (hero.roots.some((root) => root.id === own.root)) throw refuse("that directory is seeded and registered already");
	return { dir, hero };
}

/** Appends a cape root's path to the hero's config `roots`; returns the config's path when it changed. */
function listRoot(hero: Bridge, rootPath: string): string {
	const config = parseDocument(readFileSync(hero.configPath, "utf8"));
	const roots = config.get("roots");
	const path = relative(hero.dir, rootPath).replace(/\\/g, "/");
	if (!isSeq(roots)) throw new Error(`${hero.configPath} lists no roots`);
	roots.add(path);
	writeFileSync(hero.configPath, config.toString({ lineWidth: 0 }));
	return hero.configPath;
}

/** The seeded repo seed acts on without `--at`: the nearest one, unless it lies outside the git checkout, which is then its own. */
function nearestRepo(cwd: string, top: string): string {
	const found = findBridge(cwd)?.dir;
	const rel = found === undefined ? undefined : relative(top, found);
	return found !== undefined && rel !== undefined && !rel.startsWith("..") && !isAbsolute(rel) ? found : top;
}

export async function ie4a628f20d785d3a941ca681bf26e3cf(options: { noCapes: boolean; rootKind: string; workspace: boolean; migrate: boolean; noMigrate: boolean }, ctx: Ctx): Promise<void> {
	const { noCapes, rootKind, workspace, migrate, noMigrate } = options;
	const root = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: ctx.cwd, encoding: "utf8" });
	if (root.status !== 0) throw new Error("seed makes a git repo a bridge, and this is not a git repo");
	const top = root.stdout.trim();
	// --at seeds a directory of the hero, committed in the hero's git; run inside such a directory, seed acts on it, the nearest repo nosedive knows.
	const at = process.env.NOSEDIVE_AT ? localCapeDir(ctx.cwd, process.env.NOSEDIVE_AT) : undefined;
	const dir = at?.dir ?? nearestRepo(ctx.cwd, top);
	const changed: string[] = [];

	const repo = basename(dir);
	const configPath = join(dir, ".nosedive", "config.yaml");
	// A root outside the checkout belongs to another git, which seed never writes into.
	for (const listed of existsSync(configPath) ? (readRepoConfig(dir)?.roots ?? []) : []) {
		const rel = relative(top, listed.dir);
		if (rel.startsWith("..") || isAbsolute(rel)) throw new Error(`${configPath} lists root ${listed.id} at ${listed.dir}, outside this git checkout, ${top}: seed writes into no other checkout, so it wrote nothing`);
	}
	if (migrate && noMigrate) throw new Error("seed takes --migrate or --no-migrate, not both");
	// Only a repo seeded for the first time, new or legacy (no roots yet), migrates unasked (seed-asks-before-migrating).
	const asking = !migrate && !noMigrate && existsSync(configPath) && parseDocument(readFileSync(configPath, "utf8")).has("roots");
	const corePending = pendingMigrations(dir);
	if (asking && corePending.length > 0) throw pendingError(ctx, repo, [...corePending.map((migration) => coreMigration(ctx, migration)), ...(noCapes ? [] : await pendingCapeMigrations(dir, ctx))]);
	// --no-migrate leaves out what was pending, but not what seed itself makes pending, as --workspace does hero-self.
	const chain = noMigrate ? MIGRATIONS.filter((migration) => !corePending.includes(migration)) : MIGRATIONS;
	// A repo it knows is brought to today's shape before anything else reads it.
	for (const name of existsSync(configPath) ? runMigrations(dir, ctx, chain) : []) ctx.out(`migrated ${repo}: ${name}`);
	// Its capes build next, so their migrations are known before seed writes anything else; a new repo wears none.
	const failed: string[] = [];
	if (!noCapes && readRepoConfig(dir)) await buildCapes(dir, ctx, failed);
	if (asking && !noCapes) {
		const capePending = await pendingCapeMigrations(dir, ctx);
		if (capePending.length > 0) throw pendingError(ctx, repo, capePending);
	}
	if (!readRepoConfig(dir)) {
		// A repo is what its config enables: its id, its first root, and a workspace when asked for.
		// The root's kind is one of core's, which the root says in a canonical scope.
		const core = ctx.capes[0]!;
		if (core.kinds[rootKind] === undefined) throw new Error(`no kind ${rootKind} is declared, so it cannot be the root's kind`);
		const kind = { ...(core.kinds[rootKind] as object), name: rootKind, owner: CORE_OWNER, repoDir: core.repoDir };
		const pin = pinOf(kind, { roots: [] });
		mkdirSync(join(dir, ".nosedive"), { recursive: true });
		const scopes = [{ [CORE_OWNER]: { canonical: true, ...pin } }];
		const home = workspace && rootKind !== "cape" ? "self" : "kb";
		const root = mintKbDoc(join(dir, home), { kind: rootKind, name: repo, gist: `What ${repo} holds`, title: repo, scopes });
		// The primary root is the one whose id is the repo's.
		const config = { id: root.id, migrations: MIGRATIONS.map((migration) => migration.id), ...(workspace ? { workspace: "./workspace" } : {}), roots: [`${home}/${root.id}.md`] };
		writeFileSync(configPath, new Document(config).toString({ lineWidth: 0 }));
		changed.push(root.path, configPath);
	} else {
		const config = parseDocument(readFileSync(configPath, "utf8"));
		if (config.errors.length > 0) throw new Error(`${configPath}: ${config.errors[0]!.message}`);
		const before = config.toString({ lineWidth: 0 });
		// --workspace adds a workspace a repo lacks.
		if (workspace && config.has("roots") && !config.has("workspace")) {
			config.set("workspace", "./workspace");
			// A data repo may already have recorded this migration as a no-op before it could do work.
			const heroSelf = MIGRATIONS.find((migration) => migration.name === "hero-self")!;
			const listed = (config.toJS() as { migrations?: string[] }).migrations ?? [];
			config.set("migrations", listed.filter((id) => id !== heroSelf.id));
		}
		if (config.toString({ lineWidth: 0 }) !== before) {
			writeFileSync(configPath, config.toString({ lineWidth: 0 }));
			changed.push(configPath);
		}
	}

	// nosedive's own ignores live beside its config, so the repo's own .gitignore stays the user's.
	const ignorePath = join(dir, ".nosedive", ".gitignore");
	const ignore = existsSync(ignorePath) ? readFileSync(ignorePath, "utf8") : "";
	const missing = NOSEDIVE_IGNORES.filter((line) => !ignore.split(/\r?\n/).includes(line));
	if (missing.length > 0) {
		writeFileSync(ignorePath, `${ignore}${ignore && !ignore.endsWith("\n") ? "\n" : ""}${missing.map((line) => `${line}\n`).join("")}`);
		changed.push(ignorePath);
	}

	const own = readRepoConfig(dir)!;
	// A cape's or hero's packages build from its lockfile, which a global ignore could hide from every commit.
	if (findRoot(dir, "cape") || own.workspace !== undefined) {
		const repoIgnore = join(dir, ".gitignore");
		const text = existsSync(repoIgnore) ? readFileSync(repoIgnore, "utf8") : "";
		if (!text.split(/\r?\n/).includes(LOCKFILE)) {
			writeFileSync(repoIgnore, `${text}${text && !text.endsWith("\n") ? "\n" : ""}${LOCKFILE}\n`);
			changed.push(repoIgnore);
		}
	}
	if (own.workspace !== undefined) placeWorkspace(dir, own.workspace);
	const readme = join(dir, "README.md");
	if (!existsSync(readme) && own.root) {
		const primary = own.roots.find((root) => root.id === own.root)!;
		writeFileSync(readme, `# [${repo}](${relative(dir, primary.path).replace(/\\/g, "/")})\n`);
		changed.push(readme);
	}

	// A local cape's root joins the hero's roots in the commit that makes it, or in one of its own when it was made before.
	const registering = at && own.root ? own.roots.find((root) => root.id === own.root) : undefined;
	const registered = changed.length === 0 && registering !== undefined;
	if (at && registering) changed.push(listRoot(at.hero, registering.path));
	if (changed.length > 0) {
		commitFiles(top, changed, registered ? `seed: ${repo} registered` : `seed: ${repo} set up`, ctx.capes[0]!.version);
		ctx.out(registered ? `registered ${repo}` : `seeded ${repo}`);
	} else {
		ctx.out(`${repo} is already seeded`);
	}

	// A cape's code files exist as soon as its docs call for them (seed-scaffolds-capes).
	if (findRoot(dir, "cape")) {
		const scaffolded = scaffoldCape(dir);
		if (scaffolded.written.length > 0) commitFiles(top, scaffolded.written.map((file) => join(dir, file)), `seed: ${repo} scaffolded`, ctx.capes[0]!.version);
		if (scaffolded.lines.join() !== "nothing to scaffold") ctx.out([`scaffolded ${repo}:`, ...scaffolded.lines.map((line) => `  ${line}`)].join("\n"));
	}

	// Each root's body is its tree, rendered from its links, when it links a .feat.
	const roots = own.roots.filter((root) => !nestedRoot(own, root)).flatMap((root) => {
		const doc = findKbDoc(root.dir, root.id);
		return doc && rendersTree(doc) ? [{ doc, kbDir: root.dir }] : [];
	});
	for (const { doc, kbDir } of roots) {
		const tree = renderTree(kbDir, doc, [...(own.kindsDir ? [own.kindsDir] : []), ...(own.reposDir ? [own.reposDir] : []), ...own.roots.map((root) => root.dir)]);
		if (tree === doc.body) continue;
		writeKbDoc(doc.path, doc.yaml, tree);
		commitFiles(top, [doc.path], `seed: ${repo} tree rendered`, ctx.capes[0]!.version);
		ctx.out(`rendered the tree of ${String(doc.fm.name)}`);
	}

	// A migration that waited for capes to build runs now that they have, so it needs no second seed.
	const migrateAgain = () => {
		for (const name of runMigrations(dir, ctx, chain)) ctx.out(`migrated ${repo}: ${name}`);
	};
	// Last, the hero's agent instruction files show the surface as it now is, the capes just built included.
	const writeSurface = async () => {
		// A local cape lies in the hero's checkout: the hero's surface is the hero's.
		if (relative(top, dir) !== "" || !hasSurface(dir)) return;
		const written = writeAgentSurface(dir, await renderActions(ctx, false), ctx.capes[0]!.version);
		if (written.hint) ctx.out(written.hint);
		const rel = (path: string) => relative(dir, path).replace(/\\/g, "/");
		// A block restored to what HEAD holds, after a hand edit, leaves nothing to commit.
		const dirty = written.changed.filter((path) => spawnSync("git", ["status", "--porcelain", "--", path], { cwd: top, encoding: "utf8" }).stdout.trim() !== "");
		// The pilot's uncommitted edits around the block are never committed in nosedive's name.
		const held = dirty.filter((path) => !ownChange(path));
		const changed = dirty.filter((path) => !held.includes(path));
		if (changed.length > 0) {
			commitFiles(top, changed, `seed: ${repo} agent surface written`, ctx.capes[0]!.version);
			ctx.out(`wrote the agent surface into ${changed.map(rel).join(", ")}`);
		}
		if (held.length > 0) ctx.out(`wrote the agent surface into ${held.map(rel).join(", ")}, not committed: it holds uncommitted edits of yours`);
	};
	if (noCapes) {
		migrateAgain();
		return writeSurface();
	}
	migrateAgain();
	// Each worn cape's own migrations run after core's, against what core's left (cape-migration-order).
	for (const name of noMigrate ? [] : await runCapeMigrations(dir, ctx)) ctx.out(`migrated ${repo}: ${name}`);
	try {
		await writeSurface();
	} catch (err) {
		if (failed.length === 0) throw err;
		failed.push(`agent surface: ${err instanceof Error ? err.message : String(err)}`);
	}
	if (failed.length > 0) throw new Error(`some capes are not usable:\n${failed.map((failure) => `- ${failure}`).join("\n")}`);
}

/** Builds every root's capes, the active root's first, each once: a cape only another root wears is rebuilt too (seed-builds-every-roots-capes). */
async function buildCapes(dir: string, ctx: Ctx, failed: string[]): Promise<void> {
	const core = ctx.capes[0]!;
	const bridgeAt = findBridge(dir)!;
	const rootIds = [bridgeAt.activeRoot, ...bridgeAt.roots.map((root) => root.id).filter((id) => id !== bridgeAt.activeRoot)];
	const seen = new Set<string>();
	const capes = rootIds.flatMap((root) => {
		try {
			return configuredCapes({ ...bridgeAt, activeRoot: root }, core).filter((cape) => {
				const key = `${cape.repo?.id ?? cape.name}@${cape.ref}`;
				return !seen.has(key) && seen.add(key);
			});
		} catch (err) {
			failed.push(`the capes of root ${root}: ${err instanceof Error ? err.message : String(err)}`);
			return [];
		}
	});
	for (const cape of capes) {
		try {
			const built = await buildCape(bridgeAt, cape.repo ?? findRepoDoc(bridgeAt, cape.name), cape.ref, core, [], ctx.out);
			if (!built.fresh) ctx.out(`cape ${cape.spec} is built`);
			else ctx.out(`built cape ${cape.spec} ${built.version} (${built.commit.slice(0, 7)}): ${Object.keys(built.actions).join(", ") || "no actions"}`);
		} catch (err) {
			failed.push(`${cape.spec}: ${err instanceof Error ? err.message : String(err)}${lastBuilt(bridgeAt.dir, cape.name, cape.repo?.id, core.id)}`);
		}
	}
}

type Pending = { id: string; name: string; gist: string; path?: string };

/** A core migration as seed lists it: its doc is in core's kb when core runs from a checkout. */
function coreMigration(ctx: Ctx, migration: Migration): Pending {
	const core = ctx.capes[0]!;
	const doc = core.docs[migration.id];
	const repoDir = core.repoDir ?? (core.url?.startsWith("file:") ? dirname(dirname(fileURLToPath(core.url))) : undefined);
	const path = repoDir ? findKbDoc(join(repoDir, "kb"), migration.id)?.path : undefined;
	return { id: migration.id, name: migration.name, gist: doc ? String(readKbDoc(doc.text).fm.gist ?? "") : "", ...(path ? { path } : {}) };
}

/** The refusal of a seed that would migrate unasked: each pending migration, how to read it, and how to go on. */
function pendingError(ctx: Ctx, repo: string, pending: Pending[]): Error {
	const lines = pending.flatMap((migration) => [
		`- ${migration.name}: ${migration.gist}`,
		...(migration.path ? [`  [${migration.name}](${relative(ctx.cwd, migration.path).replace(/\\/g, "/")})`] : []),
		`  nosedive crud ${migration.id}`,
	]);
	return new Error(`seed changed nothing: ${repo} has ${pending.length === 1 ? "a migration" : "migrations"} to run\n${lines.join("\n")}\nrerun with --migrate to run them all, or --no-migrate to seed without them`);
}

/** Where a cape that failed to build last built: the way back to a core it works with. */
function lastBuilt(bridgeDir: string, name: string, repo: string | undefined, coreId: string): string {
	const last = capeManifest(bridgeDir)
		.filter((build) => build.repo === repo && build.core !== coreId && build.coreVersion)
		.sort((a, b) => a.builtAt.localeCompare(b.builtAt))
		.at(-1);
	if (!last) return "";
	return `\n  it last built at ${last.commit.slice(0, 7)} with core ${last.coreVersion}: pin it there, with \`ref: ${last.commit}\` on its .cape link, or go back to that core`;
}

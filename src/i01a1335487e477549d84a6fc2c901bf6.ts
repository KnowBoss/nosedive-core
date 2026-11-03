import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { CapeDoc } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a14fdf275b70b48f86f7f5c651719d as kbDocKind } from "./i01a14fdf275b70b48f86f7f5c651719d.ts";
import { i01a133548178739398941123114401ad as usageId } from "./i01a133548178739398941123114401ad.ts";
import { CORE_OWNER, i01a18e2a3b4b798d98068d4778a158e6 as docKind } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";

export type CapeSource = {
	docs: Record<string, CapeDoc>;
	/** Each action's and function's entrypoint: its doc id, export name and file. */
	entries: { id: string; name: string; file: string }[];
	/** Each kind the repo declares: its name, to its declaration's meta (schema, doneWhen) and links. */
	kinds: Record<string, unknown>;
};

const READ = new Set(["action", "function", "migration", "kind"]);
const QUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/**
 * `fromSrc` reads only the docs whose ids name files in `src/`, never the rest of the kb: a doc with no code yet is left out.
 * `versions` records each kind's version, which asks git for the history of its doc.
 * `kbOf` reads that directory in place of the repo's primary kb, as scaf does for a doc in another of its roots.
 * Only docs whose kind is core's count: a repo's action says so in a canonical scope, core's own do not need one.
 */
export function i01a1335487e477549d84a6fc2c901bf6(repoDir: string, fromSrc = false, versions = false, kbOf?: string): CapeSource {
	const docs: Record<string, CapeDoc> = {};
	const entries: CapeSource["entries"] = [];
	const kinds: CapeSource["kinds"] = {};
	const parents = new Map<string, string[]>();
	const kbDir = kbOf ?? readRepoConfig(repoDir)?.kbDir ?? join(repoDir, "kb");
	const holder = readRepoConfig(repoDir)?.id;
	const declare = (doc: ReturnType<typeof codeDocs>[number]) => {
		const meta = (doc.fm.meta ?? {}) as { schema?: unknown };
		const file = relative(repoDir, doc.path).replace(/\\/g, "/");
		const version = versions ? kindVersion(repoDir, file, meta.schema) : undefined;
		// Whether the version is on the trunk is recorded with it: a trunk only grows, so the answer stays true for whoever wears this build.
		const doneWhen = doneWhenOf(doc.body);
		kinds[String(doc.fm.name)] = { ...meta, links: doc.fm.links ?? [], id: doc.fm.id, file, digest: schemaDigest(meta.schema), ...(doneWhen !== undefined ? { doneWhen } : {}), ...(version ? { version, published: onTrunk(repoDir, version) } : {}) };
	};
	// The kinds a repo keeps in .nosedive/kinds/ are as much its own as those in its kb.
	const kindsDir = join(repoDir, ".nosedive", "kinds");
	for (const doc of existsSync(kindsDir) ? codeDocs(kindsDir, undefined, true) : []) declare(doc);
	for (const doc of codeDocs(kbDir, fromSrc ? srcDocFiles(repoDir) : undefined)) {
		const kind = docKind(doc, holder);
		if (kind.owner !== CORE_OWNER) continue;
		if (kind.name === "kind") declare(doc);
		if (kind.name !== "action" && kind.name !== "function" && kind.name !== "migration") continue;
		const id = String(doc.fm.id);
		const meta = (doc.fm.meta ?? {}) as { usages?: unknown };
		const usages = Array.isArray(meta.usages) ? meta.usages.map(String) : [];
		docs[id] = {
			// A migration's code is a function's: no usages, its tests beside it.
			kind: kind.name === "action" ? "action" : "function",
			name: String(doc.fm.name ?? ""),
			gist: String(doc.fm.gist ?? ""),
			usages: usages.map((text) => ({ id: usageId(text, id), text })),
			top: true,
			text: doc.text,
			body: doc.body.trim(),
		};
		parents.set(id, parentIds(doc.fm.links));
		const name = `i${id.replace(/-/g, "")}`;
		entries.push({ id, name, file: join(repoDir, "src", `${name}.ts`) });
	}
	// An action under another action is nested: reachable by name, not listed.
	for (const [id, ids] of parents) docs[id]!.top = !ids.some((parent) => parent in docs);
	return { docs, entries, kinds };
}

/** How many action, function and migration docs the repo has that do not name core as their kind's owner: bare core kinds, written before canonical kinds, which a cape cannot export. */
export function uncanonicalDocs(repoDir: string): number {
	const holder = readRepoConfig(repoDir)?.id;
	const kbDir = readRepoConfig(repoDir)?.kbDir ?? join(repoDir, "kb");
	if (!existsSync(kbDir)) return 0;
	return codeDocs(kbDir).filter((doc) => ["action", "function", "migration"].includes(String(doc.fm.kind)) && docKind(doc, holder).owner !== CORE_OWNER).length;
}

/** What each non-test file in `src/` exports besides its default function, `i<hex>`: its values and its types, for capes that import them from core. */
export function namedExports(repoDir: string): { file: string; values: string[]; types: string[] }[] {
	const src = join(repoDir, "src");
	if (!existsSync(src)) return [];
	return readdirSync(src)
		.filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
		.sort()
		.flatMap((file) => {
			const text = readFileSync(join(src, file), "utf8");
			const named = (pattern: RegExp) => [...text.matchAll(pattern)].map((match) => match[1]!).filter((name) => !/^i[0-9a-f]{32}$/.test(name));
			const values = named(/^export (?:async )?(?:function|const|class) (\w+)/gm);
			const types = named(/^export (?:type|interface) (\w+)/gm);
			return values.length + types.length > 0 ? [{ file, values, types }] : [];
		});
}

/** The doc files `src/` names: one per code file named by an id, which a usage's file, named by a hash, never matches. */
function srcDocFiles(repoDir: string): string[] {
	const src = join(repoDir, "src");
	if (!existsSync(src)) return [];
	return readdirSync(src).flatMap((file) => {
		const hex = /^i([0-9a-f]{32})\.ts$/.exec(file)?.[1];
		return hex ? [`${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}.md`] : [];
	});
}

/** The kb's actions, functions and kinds, read whole; every other doc is read only as far as its kind. `anyKind` reads them all. */
function codeDocs(kbDir: string, files?: string[], anyKind = false) {
	return (files ?? readdirSync(kbDir))
		.filter((file) => file.endsWith(".md") && (!files || existsSync(join(kbDir, file))))
		.sort()
		.flatMap((file) => {
			const path = join(kbDir, file);
			if (!anyKind && !READ.has(kbDocKind(path) ?? "")) return [];
			const text = readFileSync(path, "utf8");
			try {
				return [{ ...readKbDoc(text, path), text, path }];
			} catch {
				return [];
			}
		});
}

function parentIds(links: unknown): string[] {
	if (!Array.isArray(links)) return [];
	return links.flatMap((link) =>
		link && typeof link === "object"
			? Object.entries(link as Record<string, { rel?: unknown } | null>)
					.filter(([, value]) => value?.rel === "parent.feat")
					.flatMap(([target]) => QUID.exec(target) ?? [])
			: [],
	);
}

/** The newest commit that changed a kind doc's schema, not its prose; undefined when the schema as it is now is not committed. */
export function kindVersion(repoDir: string, file: string, schema: unknown): string | undefined {
	const commits = git(repoDir, ["log", "--format=%H", "--", file]).toString().split("\n").filter(Boolean);
	// One call reads the doc at every commit: each answer is `<oid> blob <size>`, then the doc, then a newline.
	const blobs = git(repoDir, ["cat-file", "--batch"], commits.map((commit) => `${commit}:${file}\n`).join(""));
	let version: string | undefined;
	let at = 0;
	for (const commit of commits) {
		const end = blobs.indexOf("\n", at);
		const size = Number(/ blob (\d+)$/.exec(blobs.subarray(at, end).toString())?.[1]);
		if (Number.isNaN(size)) break;
		const doc = blobs.subarray(end + 1, end + 1 + size).toString("utf8");
		at = end + size + 2;
		if (JSON.stringify(schemaOf(doc) ?? null) !== JSON.stringify(schema ?? null)) break;
		version = commit;
	}
	return version;
}

/**
 * A short digest of a schema, the same for the same schema whatever order its keys were written in. It lets a version a force-push
 * orphaned be re-pinned later to the commit that now holds a schema with the same digest.
 */
export function schemaDigest(schema: unknown): string {
	return createHash("sha256").update(canonical(schema ?? null)).digest("hex").slice(0, 12);
}

/**
 * The first line of a kind doc's `## Done when` section, which says when a doc of that kind is done: empty when the section is,
 * undefined when the doc has none, which makes the kind durable. The heading is matched in any case.
 */
export function doneWhenOf(body: string): string | undefined {
	const section = /^##[ \t]+done[ \t]+when[ \t]*$([\s\S]*?)(?=^#{1,2}\s|(?![\s\S]))/im.exec(body)?.[1];
	if (section === undefined) return undefined;
	return section.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
}

/** What is amiss with a kind doc's Done when: a heading that looks like one but is not read as one, or a section that says nothing. */
export function doneWhenSlips(body: string): string[] {
	const slips: string[] = [];
	const said = doneWhenOf(body);
	for (const line of body.split("\n")) {
		const near = /^(#{1,6})\s*done\s*when\b.*$/i.exec(line.trim());
		if (near && !/^##[ \t]+done[ \t]+when[ \t]*$/i.test(line)) slips.push(`its heading "${line.trim()}" is not read as a Done when section, which is \`## Done when\``);
	}
	if (said === "") slips.push("its Done when section is empty: say when a doc of it is done");
	return slips;
}

function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	if (value !== null && typeof value === "object") {
		return `{${Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([key, each]) => `${JSON.stringify(key)}:${canonical(each)}`).join(",")}}`;
	}
	return JSON.stringify(value);
}

/** Whether a commit is on the origin trunk the repo last fetched. */
export function onTrunk(repoDir: string, commit: string): boolean {
	const head = git(repoDir, ["symbolic-ref", "-q", "refs/remotes/origin/HEAD"]).toString().trim();
	return [head || "refs/remotes/origin/main", "refs/remotes/origin/master"].some((ref) => spawnSync("git", ["merge-base", "--is-ancestor", commit, ref], { cwd: repoDir }).status === 0);
}

function schemaOf(doc: string): unknown {
	try {
		return (readKbDoc(doc).fm.meta as { schema?: unknown } | undefined)?.schema;
	} catch {
		return undefined;
	}
}

function git(cwd: string, args: string[], input?: string): Buffer {
	const result = spawnSync("git", args, { cwd, input, maxBuffer: 1 << 28 });
	return result.status === 0 ? result.stdout : Buffer.alloc(0);
}

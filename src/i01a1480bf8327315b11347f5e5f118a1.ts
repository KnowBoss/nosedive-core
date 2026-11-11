import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { basename, relative } from "node:path";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./i01a13354850c7ba3ba5b8ac41a7b6b11.ts";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { i01a138b2b8ed775297973c2aad478c8f as workspaceRepo } from "./i01a138b2b8ed775297973c2aad478c8f.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { isDurable, kindOfDoc } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { i01a19005c109715583553072f4e38dc4 as commitSubject } from "./i01a19005c109715583553072f4e38dc4.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "./i01a1335483aa776cb84df698b04adc06.ts";
import { readSection } from "./i794ab6e0060f5ede8b0148203fe6df81.ts";
import { nestedRoot } from "./i01a1934563e77ed886f06d04416385ef.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a14a5504467ef08586b828ebabc148 as renderTree, rendersTree } from "./i01a14a5504467ef08586b828ebabc148.ts";

type Listed = ReturnType<typeof listKbDocs>[number];

/**
 * Returns the dropped docs' paths relative to the bridge, and once the drop has committed reports `unlinked <holder path>: <rel> <dropped doc path>` through `report` for each link removed. A drop removes the `.feat` links to the docs it drops, and those by a rel their kind names in `meta.next`, from the docs they
 * hang from, once one of those records it (drops-recorded); `sure` drops a doc that hangs from none.
 */
export function i01a1480bf8327315b11347f5e5f118a1(cwd: string, ids: string[], hard: boolean, capes: Cape[], sure = false, report?: (line: string) => void): string[] {
	const bridge = findBridge(cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const at = (path: string) => relative(bridge.dir, path).replace(/\\/g, "/");
	const docs = [...new Set(ids)].map((id) => {
		const doc = locateKbDoc(bridge, id);
		if (!doc) throw new Error(`no doc ${id} in the bridge or its workspace`);
		return { id, doc, label: `${String(doc.fm.kind)} ${String(doc.fm.name)}` };
	});
	const dropping = new Set(docs.map(({ id }) => id));
	const one = docs.length === 1;
	const labelOf = new Map(docs.map(({ id, label }) => [id, label]));

	// Every kb a link to them could live in: the bridge's, and each repo checked out in its workspace.
	const kbDirs = [bridge.kbDir];
	const repoDirs = [bridge.dir];
	if (bridge.workspace && existsSync(bridge.workspace)) {
		for (const entry of readdirSync(bridge.workspace, { withFileTypes: true })) {
			if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
			const repo = workspaceRepo(bridge, entry.name);
			kbDirs.push(repo.kbDir);
			repoDirs.push(repo.dir);
		}
	}
	// The rels a dropped doc's kind names in `meta.next`, as next lists it by (kind-declared links); a durable kind's are none, as next's are.
	const declared = new Map(
		docs.map(({ id, doc }) => {
			const { kind } = kindOfDoc(doc, bridge, capes);
			return [id, new Set(kind && !isDurable(kind) ? (kind.next ?? []) : [])] as const;
		}),
	);
	const blockers: string[] = [];
	const block = (id: string, why: string) => blockers.push(one ? why : `${labelOf.get(id)}: ${why}`);
	// The links the drop removes, by the doc holding them, and the docs each dropped one hangs from.
	const unlinks = new Map<Listed, { repoDir: string; at: number[]; links: { rel: string; id: string }[] }>();
	const parents = new Map<string, Map<string, { id: string; label: string; body: string }>>(docs.map(({ id }) => [id, new Map()]));
	const hangsFrom = (id: string, doc: { fm: Record<string, unknown>; body: string; path: string }) =>
		parents.get(id)!.set(doc.path, { id: String(doc.fm.id), label: `${String(doc.fm.kind)} ${String(doc.fm.name)}`, body: doc.body });
	// A root seed renders, one linking a .feat, has its tree for a body, so a link there is seed's to remove: the drop renders it again (drops-rerender-tree).
	const rendered = new Map(bridge.roots.filter((root) => !nestedRoot(bridge, root)).map((root) => [root.id, root]));
	const rerender = new Set<string>();
	for (const [index, kbDir] of kbDirs.entries()) {
		if (!existsSync(kbDir)) continue;
		// A doc git does not track (ignored, or never added) is no part of the kb's history, so it cannot block.
		const listed = spawnSync("git", ["ls-files"], { cwd: kbDir, encoding: "utf8" });
		const tracked = listed.status === 0 ? new Set(listed.stdout.split("\n").filter(Boolean)) : undefined;
		for (const other of listKbDocs(kbDir)) {
			if (dropping.has(String(other.fm.id))) continue;
			if (tracked && !tracked.has(basename(other.path))) continue;
			(Array.isArray(other.fm.links) ? other.fm.links : []).forEach((link, position) => {
				for (const [target, value] of Object.entries((link ?? {}) as Record<string, { rel?: unknown } | null>)) {
					for (const id of dropping) {
						if (!target.includes(id)) continue;
						const rel = String(value?.rel ?? "");
						if (rel === "parent.feat") {
							block(id, `${at(other.path)} hangs under it: drop it first`);
							continue;
						}
						// Only the tree's links and those its kind names in meta.next go with it; any other says something a drop must not undo unasked, as a worn cape's does.
						if (!rel.endsWith(".feat") && !declared.get(id)!.has(rel)) {
							block(id, `${at(other.path)} links it as ${rel || "a link"}: remove that link first`);
							continue;
						}
						hangsFrom(id, other);
						const entry = unlinks.get(other) ?? { repoDir: repoDirs[index]!, at: [], links: [] };
						if (!entry.at.includes(position)) {
							entry.at.push(position);
							entry.links.push({ rel, id });
						}
						unlinks.set(other, entry);
					}
				}
			});
			for (const id of dropping) {
				if (!other.body.includes(`${id}.md`)) continue;
				if (rendered.has(String(other.fm.id)) && rendersTree(other)) rerender.add(String(other.fm.id));
				else block(id, `${at(other.path)} links it in its body: remove that link first`);
			}
		}
	}
	for (const repoDir of repoDirs) {
		const config = readRepoConfig(repoDir);
		for (const root of config?.roots ?? []) if (dropping.has(root.id)) block(root.id, `${at(config!.configPath)} lists it among its roots`);
	}
	// A dropped doc hangs too from what its own parent.feat links name.
	for (const { id, doc } of docs) {
		for (const link of Array.isArray(doc.fm.links) ? doc.fm.links : []) {
			for (const [target, value] of Object.entries((link ?? {}) as Record<string, { rel?: unknown } | null>)) {
				if (value?.rel !== "parent.feat") continue;
				const parentId = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(target)?.[1]?.toLowerCase();
				const parent = parentId && locateKbDoc(bridge, parentId);
				if (parent) hangsFrom(id, parent);
			}
		}
	}
	// What a dropped doc held is recorded, by whoever drops it, under `## Dropped` > `### <id>` on a doc it hangs from (drops-recorded).
	for (const { id, doc } of docs) {
		const from = [...parents.get(id)!.values()];
		if (from.some((parent) => dropping.has(parent.id))) continue;
		if (from.length === 0) {
			if (!sure) block(id, `it hangs from no doc, so none can record what it held: \`nosedive crud --drop ${id} --sure\` drops it anyway`);
			continue;
		}
		const gist = String(doc.fm.gist ?? "").trim();
		const recorded = from.some((parent) => {
			const text = readSection(parent.body, ["Dropped", id]);
			return text !== undefined && text !== "" && text !== gist;
		});
		if (!recorded) {
			block(
				id,
				`${from.map((parent) => parent.label).join(", ")} ${from.length === 1 ? "records" : "record"} nothing of what it held: read ${at(doc.path)}, check it against when it is dropped, then say what of it is kept, other than its gist: \`nosedive crud ${from[0]!.id} --section:Dropped.${id} -\``,
			);
		}
	}
	if (blockers.length > 0) {
		const head = one ? `${docs[0]!.label} was not dropped` : `none of these was dropped`;
		// What dropping one takes, as each droppable kind among them says it (drop-when).
		const said = new Map<string, string>();
		for (const { doc } of docs) {
			const { kind } = kindOfDoc(doc, bridge, capes);
			if (kind?.dropWhen && !said.has(kind.name)) said.set(kind.name, kind.dropWhen);
		}
		const terms = [...said].map(([name, text]) => `\n\nA ${name} is dropped when:\n  ${text.split("\n").join("\n  ")}`).join("");
		throw new Error(`${head}:\n  ${blockers.join("\n  ")}${terms}`);
	}

	if (!hard) {
		const durable = docs.filter(({ doc }) => isDurable(kindOfDoc(doc, bridge, capes).kind));
		if (one && durable.length) throw new Error(`${durable[0]!.label} is durable: its file keeps it findable by id, so it was not dropped; --hard drops it anyway`);
		if (durable.length) {
			throw new Error(`${durable.length} of these are durable, so none was dropped; --hard drops them anyway:\n  ${durable.map(({ label }) => label).join("\n  ")}`);
		}
	}

	const byRepo = new Map<string, string[]>();
	const add = (repoDir: string, path: string) => byRepo.set(repoDir, [...new Set([...(byRepo.get(repoDir) ?? []), path])]);
	for (const entry of docs) add(entry.doc.repoDir, entry.doc.path);
	for (const [other, { repoDir }] of unlinks) add(repoDir, other.path);
	for (const id of rerender) add(bridge.dir, rendered.get(id)!.path);
	// Named before the docs and links go, since their links are how a feat is found.
	const subjects = new Map([...byRepo.keys()].map((repoDir) => [repoDir, commitSubject(bridge, "crud", "drop", [...dropping], capes)]));
	for (const entry of docs) rmSync(entry.doc.path);
	for (const [other, { at: positions }] of unlinks) {
		for (const position of positions.sort((a, b) => b - a)) other.yaml.deleteIn(["links", position]);
		if ((other.yaml.get("links") as { items?: unknown[] } | undefined)?.items?.length === 0) other.yaml.delete("links");
		writeKbDoc(other.path, other.yaml, other.body);
	}
	// Rendered once the docs and their links are gone, as seed would render it.
	const others = [...(bridge.kindsDir ? [bridge.kindsDir] : []), ...(bridge.reposDir ? [bridge.reposDir] : []), ...bridge.roots.map((root) => root.dir)];
	for (const id of rerender) {
		const root = rendered.get(id)!;
		const doc = findKbDoc(root.dir, id);
		if (doc) writeKbDoc(doc.path, doc.yaml, renderTree(root.dir, doc, others));
	}
	for (const [repoDir, paths] of byRepo) commitFiles(repoDir, paths, subjects.get(repoDir)!, capes[0]!.version);
	const pathOf = new Map(docs.map(({ id, doc }) => [id, at(doc.path)]));
	for (const [other, { links }] of unlinks) for (const { rel, id } of links) report?.(`unlinked ${at(other.path)}: ${rel} ${pathOf.get(id)!}`);
	return docs.map(({ doc }) => at(doc.path));
}

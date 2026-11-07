import { spawnSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import { dirname } from "node:path";
import type { Cape, CapeDoc, Ctx, GateCtx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a14ab1d36771eea2bc6f13bdeb0526 as editKbDocs, type EditedDoc, type KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./i01a1335480147d0686528aee80f8ee34.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
import { i01a141f869c07c4da8288927a559c8ae as mintKbDoc } from "./i01a141f869c07c4da8288927a559c8ae.ts";
import { i01a147171f057d019118aaa1f269f5fd as findKind, kindOfDoc } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { i01a14b30eb0e72e28934c918000a26ac as loadCape } from "./i01a14b30eb0e72e28934c918000a26ac.ts";
import { i01a14b30ecc07ea18999d6255d636e39 as crudEdit } from "./i01a14b30ecc07ea18999d6255d636e39.ts";
import { i01a14fb092177d36a478d40a47166c97 as gateUsage } from "./i01a14fb092177d36a478d40a47166c97.ts";
import { i01a14fb79db47f8b94d5196027008697 as buildBase } from "./i01a14fb79db47f8b94d5196027008697.ts";

const QUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/** A doc's frontmatter and body at one moment of a crud command (crud-gate-state). */
export type DocState = { fm: Record<string, unknown>; body: string };
/** A doc one crud command touched: `before` is missing for a doc minted, `after` for one dropped. */
export type Touched = { doc: EditedDoc; before?: DocState; after?: DocState };

/** Whether a dotted path of the frontmatter, `meta.feat`, differs between two states, a missing state having nothing at it. */
export function changed(before: DocState | undefined, after: DocState | undefined, path: string): boolean {
	const at = (state: DocState | undefined) => path.split(".").reduce<unknown>((value, key) => (value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined), state?.fm);
	return JSON.stringify(at(before)) !== JSON.stringify(at(after));
}

/** A doc as the edit holds it now. */
export function stateOf(doc: EditedDoc): DocState {
	return { fm: doc.yaml.toJS() as Record<string, unknown>, body: doc.body };
}

/** A doc as it was read, before the edit changed it. */
export function stateWas(doc: EditedDoc): DocState {
	const was = readKbDoc(doc.text, doc.path);
	return { fm: was.fm, body: was.body };
}

/** Every configured cape that is built, with the hero's own actions, as pass loads them; core first. */
export async function allCapes(bridge: Bridge, ctx: Ctx): Promise<Cape[]> {
	const [core, ...capes] = ctx.capes as [Cape, ...Cape[]];
	const base = await buildBase(bridge, core);
	if (base && !capes.includes(base)) capes.unshift(base);
	for (const { build } of configuredCapes(bridge, core)) {
		if (build && !capes.some((cape) => cape.id === build.id)) capes.push(await loadCape(bridge.dir, build, core));
	}
	return [core, ...capes];
}

/** Takes docs minted for a crud command or a pass back out of git's index and the kb. */
export function discardMinted(paths: string[]): void {
	for (const path of paths) {
		spawnSync("git", ["rm", "--cached", "-q", "-f", "--", path], { cwd: dirname(path) });
		try {
			unlinkSync(path);
		} catch {
			// The command's own error is the one to report.
		}
	}
}

/**
 * Runs the before gates, then the after gates, of what one crud command did in `edit`: every doc it marked to be written, and any
 * `minted` doc, which has no before. Run once its edits are made and before its commit.
 */
export async function gateEdit(edit: KbEdit, ctx: Ctx, minted: EditedDoc[] = [], discard: string[] = []): Promise<void> {
	const touched: Touched[] = [
		...minted.map((doc) => ({ doc, after: stateOf(doc) })),
		...edit
			.touched()
			.filter((doc) => !minted.includes(doc))
			.map((doc) => ({ doc, before: stateWas(doc), after: stateOf(doc) })),
	];
	await i01a1b453a16c799bb9ce20fad1a9075b("before", edit, touched, ctx, discard);
	await i01a1b453a16c799bb9ce20fad1a9075b("after", edit, touched, ctx, discard);
}

/** Runs the before gates of docs about to be dropped, which have no after; a doc that cannot be read is left for the drop to refuse. */
export async function gateDrop(ids: string[], ctx: Ctx): Promise<void> {
	const edit = editKbDocs(ctx.cwd, ctx.capes[0]!.version, ctx.capes);
	const touched = ids.flatMap((id): Touched[] => {
		try {
			const doc = edit.doc(id);
			return [{ doc, before: stateOf(doc) }];
		} catch {
			return [];
		}
	});
	await i01a1b453a16c799bb9ce20fad1a9075b("before", edit, touched, ctx);
}

type Usage = { cape: Cape; docId: string; doc: CapeDoc; id: string; text: string; kind: string | undefined };

/**
 * Runs the `when` gates of each touched doc: the gates its kind and its own links name `crud.gate`, whose usage is
 * `<when> crud <kind>`. Docs an after gate mints are pushed onto `minted`, for the caller to discard if it fails.
 */
export async function i01a1b453a16c799bb9ce20fad1a9075b(when: "before" | "after", edit: KbEdit, touched: Touched[], ctx: Ctx, minted: string[] = []): Promise<void> {
	const linked = (doc: { fm: Record<string, unknown> } | undefined) => gateIds(doc?.fm.links);
	// Loading every cape costs, so only a doc that could have a gate pays for it.
	const loose = touched.filter(({ doc, before }) => linked(before).length > 0 || linked(doc).length > 0 || kindLinksGate(doc, edit.bridge, ctx.capes));
	if (loose.length === 0) return;
	const all = await allCapes(edit.bridge, ctx);
	const usages: Usage[] = all.flatMap((cape) =>
		Object.entries(cape.docs).flatMap(([docId, doc]) =>
			doc.kind === "action"
				? doc.usages.flatMap((usage) => {
						const gate = gateUsage(usage.text);
						return gate?.sect === "crud" && gate.when === when ? [{ cape, docId, doc, ...usage, kind: gate.kind }] : [];
					})
				: [],
		),
	);
	const mint: GateCtx["mint"] = (kbDir, fields) => {
		const made = mintKbDoc(kbDir, fields);
		minted.push(made.path);
		const added = spawnSync("git", ["add", "-N", "--", made.path], { cwd: kbDir, encoding: "utf8" });
		if (added.status !== 0) throw new Error(`git add -N ${made.path}: ${(added.stderr || added.stdout).trim()}`);
		return made;
	};
	const refuse = () => {
		throw new Error("a before gate only refuses: its edits belong in an after gate");
	};
	for (const { doc, before, after } of loose) {
		const { kind: declared, identity } = kindOfDoc(doc, edit.bridge, all);
		const ids = [...new Set([...gateIds((declared as { links?: unknown } | undefined)?.links), ...linked(before), ...linked(after)])];
		for (const id of ids) {
			if (!all.some((cape) => cape.docs[id])) throw new Error(`crud gate ${id} of ${String(doc.fm.name)} is in no built cape: run \`nosedive seed\``);
			const usage = usages.find((candidate) => candidate.docId === id && takes(candidate, declared as { id?: string } | undefined, identity.name, edit.bridge, all));
			if (!usage) continue;
			const entry = usage.cape.index[namespacedUuid(usage.docId, usage.cape.id)];
			const gate: GateCtx = {
				core: all[0]!,
				capes: all.slice(1),
				bridge: edit.bridge,
				doc,
				args: {},
				edit,
				when,
				before,
				after,
				crud: when === "after" ? (target, field, value) => crudEdit(edit, target, field, value, ctx) : refuse,
				mint: when === "after" ? mint : refuse,
				out: ctx.out,
				err: ctx.err,
			};
			try {
				if (typeof entry !== "function") throw new Error(`${usage.cape.name} has no entrypoint for it`);
				await entry({ usage: `u${usage.id}`, args: {}, ctx, gate });
			} catch (error) {
				throw new Error(`crud gate ${usage.doc.name} ${when === "before" ? "refused" : "failed"}, so nothing was written: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}
}

/** Whether a gate usage's kind is the doc's, read as pass reads it: a bare kind is its cape's own. */
function takes(candidate: Usage, declared: { id?: string } | undefined, name: string, bridge: Bridge, all: Cape[]): boolean {
	if (candidate.kind === undefined) return true;
	const wanted = candidate.kind.includes(":") ? findKind(candidate.kind, bridge, all) : (candidate.cape.kinds[candidate.kind] as { id?: string } | undefined);
	return declared ? wanted?.id === declared.id : candidate.kind === name;
}

/** Whether the doc's kind, as core alone reads it, links any crud gate; a kind no loaded cape declares may, so it counts. */
function kindLinksGate(doc: EditedDoc, bridge: Bridge, capes: Cape[]): boolean {
	const { kind } = kindOfDoc(doc, bridge, capes);
	return !kind || gateIds((kind as { links?: unknown }).links).length > 0;
}

/** The ids of the docs a links list names as `crud.gate`, in order. */
function gateIds(links: unknown): string[] {
	if (!Array.isArray(links)) return [];
	return links.flatMap((link) =>
		link && typeof link === "object"
			? Object.entries(link as Record<string, { rel?: unknown } | null>)
					.filter(([, value]) => value?.rel === "crud.gate")
					.flatMap(([target]) => QUID.exec(target) ?? [])
			: [],
	);
}

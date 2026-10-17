import type { Args, Cape, Ctx, GateCtx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./i01a1335480147d0686528aee80f8ee34.ts";
import { i01a1335482437c9eb145885f65f12aa1 as matchUsage } from "./i01a1335482437c9eb145885f65f12aa1.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
import { i01a147171f057d019118aaa1f269f5fd as findKind } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { i01a14ab1d36771eea2bc6f13bdeb0526 as editKbDocs } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a14b30eb0e72e28934c918000a26ac as loadCape } from "./i01a14b30eb0e72e28934c918000a26ac.ts";
import { i01a14b30ecc07ea18999d6255d636e39 as crudEdit } from "./i01a14b30ecc07ea18999d6255d636e39.ts";

const QUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const SECT = /^pass --([a-z0-9][a-z0-9-]*) <quid>(?= |$)/;

export async function ib4959fbe2cef5f0ba22879fe0bbd5c00(argv: string[], ctx: Ctx): Promise<void> {
	const bridge = findBridge(ctx.cwd);
	if (!bridge) throw new Error("pass runs from a bridge: run `nosedive seed` first");
	const [core, ...capes] = ctx.capes as [Cape, ...Cape[]];
	for (const { build } of configuredCapes(bridge, core)) {
		if (build && !capes.some((cape) => cape.id === build.id)) capes.push(await loadCape(bridge.dir, build, core));
	}
	const all = [core, ...capes];

	// pass knows no sect itself: its gates' usages say what it takes.
	const usages = [...new Set(all.flatMap((cape) => Object.values(cape.docs).flatMap((doc) => (doc.kind === "gate" ? doc.usages.map((usage) => usage.text) : []))))].sort();
	const listing = usages.map((usage) => `  ${usage}`).join("\n");
	if (argv.length === 0 || argv[0] === "--help") {
		ctx.out([Object.values(core.docs).find((candidate) => candidate.name === "pass")!.gist, "", listing || "  (no gate declares a usage)"].join("\n"));
		return;
	}
	const matched = usages.flatMap((usage) => {
		try {
			return [{ sect: SECT.exec(usage)![1]!, args: matchUsage([usage], ["pass", ...argv]).args }];
		} catch {
			return [];
		}
	});
	if (matched.length === 0) throw new Error(`no gate usage matches \`pass ${argv.join(" ")}\`; usages:\n${listing}`);
	const sect = matched[0]!.sect;
	const args: Args = {};
	for (const match of matched) {
		for (const [key, value] of Object.entries(match.args)) if (args[key] === undefined || args[key] === false) args[key] = value;
	}
	// The sect's option binds the quid; the gates get the rest.
	const key = sect.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
	const quid = String(args[key]).toLowerCase();
	delete args[key];
	if (!QUID.test(quid)) throw new Error(`not a quid: ${quid}`);

	const edit = editKbDocs(ctx.cwd);
	const doc = edit.doc(quid);
	const kind = String(doc.fm.kind);
	const ids = [...new Set([...gateIds(findKind(kind, [doc.kbDir, bridge.kbDir], all)?.links, sect), ...gateIds(doc.fm.links, sect)])];
	if (ids.length === 0) throw new Error(`${String(doc.fm.name)} links no ${sect}.gate, nor does its kind ${kind}`);

	const gateCtx: GateCtx = {
		core,
		capes,
		bridge,
		doc,
		args,
		edit,
		crud: (target, key, value) => crudEdit(edit, target, key, value, ctx),
		out: ctx.out,
		err: ctx.err,
	};
	for (const { name, run } of ids.map((id) => gate(all, id))) {
		try {
			await run(gateCtx);
		} catch (error) {
			throw new Error(`gate ${name} failed, so nothing was written: ${error instanceof Error ? error.message : String(error)}`);
		}
		ctx.out(`gate ${name}: passed`);
	}
	const written = edit.commit(`pass(${String(doc.fm.name)}): ${sect}`);
	if (written.length > 0) ctx.out(written.join("\n"));
}

/** The ids of the docs a links list names as `<sect>.gate`, in order. */
function gateIds(links: unknown, sect: string): string[] {
	if (!Array.isArray(links)) return [];
	return links.flatMap((link) =>
		link && typeof link === "object"
			? Object.entries(link as Record<string, { rel?: unknown } | null>)
					.filter(([, value]) => value?.rel === `${sect}.gate`)
					.flatMap(([target]) => QUID.exec(target) ?? [])
			: [],
	);
}

function gate(capes: Cape[], id: string): { name: string; run: (ctx: GateCtx) => unknown } {
	for (const cape of capes) {
		const doc = cape.docs[id];
		const run = cape.index[namespacedUuid(id, cape.id)];
		if (doc?.kind === "gate" && typeof run === "function") return { name: doc.name, run: run as (ctx: GateCtx) => unknown };
	}
	throw new Error(`gate ${id} is in no built cape, so nothing was run`);
}

import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { usageHelp, type Args, type Cape, type CapeDoc, type Ctx, type GateCtx, type UsageDescription } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./i01a1335480147d0686528aee80f8ee34.ts";
import { i01a1335482437c9eb145885f65f12aa1 as matchUsage } from "./i01a1335482437c9eb145885f65f12aa1.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge, type Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1934563e77ed886f06d04416385ef as localCapes } from "./i01a1934563e77ed886f06d04416385ef.ts";
import { i01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
import { i01a147171f057d019118aaa1f269f5fd as findKind, kindOfDoc } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { i01a18e40518e7f15a2066909dca2be43 as listKinds } from "./i01a18e40518e7f15a2066909dca2be43.ts";
import { i01a14ab1d36771eea2bc6f13bdeb0526 as editKbDocs } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a14b30eb0e72e28934c918000a26ac as loadCape } from "./i01a14b30eb0e72e28934c918000a26ac.ts";
import { i01a14b30ecc07ea18999d6255d636e39 as crudEdit } from "./i01a14b30ecc07ea18999d6255d636e39.ts";
import { i01a14fb092177d36a478d40a47166c97 as gateUsage } from "./i01a14fb092177d36a478d40a47166c97.ts";
import { i01a14fb79db47f8b94d5196027008697 as buildBase } from "./i01a14fb79db47f8b94d5196027008697.ts";
import { i01a141f869c07c4da8288927a559c8ae as mintKbDoc } from "./i01a141f869c07c4da8288927a559c8ae.ts";
import { discardMinted } from "./i01a1b453a16c799bb9ce20fad1a9075b.ts";

const ANY = "any doc";
const QUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/** One gate usage, with the action that declares it. */
type Usage = { cape: Cape; docId: string; doc: CapeDoc; id: string; text: string; description?: UsageDescription; sect: string; kind: string | undefined };

export async function ib4959fbe2cef5f0ba22879fe0bbd5c00(argv: string[], ctx: Ctx): Promise<void> {
	const bridge = findBridge(ctx.cwd);
	if (!bridge) throw new Error("pass runs from a bridge: run `nosedive seed` first");
	const [core, ...capes] = ctx.capes as [Cape, ...Cape[]];
	const base = await buildBase(bridge, core);
	if (base && !capes.includes(base)) capes.unshift(base);
	// A worn cape with no build for this core has no gates here, and says so rather than seeming to have none (unbuilt-said).
	const unbuilt: string[] = [];
	for (const { build, name } of configuredCapes(bridge, core)) {
		if (!build) unbuilt.push(name);
		else if (!capes.some((cape) => cape.id === build.id)) capes.push(await loadCape(bridge.dir, build, core));
	}
	const missing = unbuilt.map((name) => `\n\n${name}\n  not built: run \`nosedive seed\`, until then its gates are missing`).join("");
	const all = [core, ...capes];

	// pass knows no sect itself: its gates' usages say what it takes.
	const usages: Usage[] = all.flatMap((cape) =>
		Object.entries(cape.docs).flatMap(([docId, doc]) =>
			doc.kind === "action"
				? doc.usages.flatMap((usage) => {
						const gate = gateUsage(usage.text);
						return gate ? [{ cape, docId, doc, ...usage, ...gate }] : [];
					})
				: [],
		),
	);
	const listing = groupedListing(usages, bridge, all, false) + missing;
	if (argv.length === 0 || argv[0] === "--help") {
		const pass = Object.values(core.docs).find((candidate) => candidate.name === "pass")!;
		const more = argv[1] === "--more";
		// --help --more <u-hash> prints that one gate usage's block.
		if (more && argv.length > 2) {
			const usage = usageHelp.find(usages, argv.slice(2), "pass");
			ctx.out(usageHelp.block(usage, usage.doc.gist));
			return;
		}
		const lines = [pass.gist, "", (more ? groupedListing(usages, bridge, all, true) + missing : listing) || "  (no gate declares a usage)"];
		const section = /(?:^|\n)## Usage\n([\s\S]*?)(?=\n## |$)/.exec(pass.body)?.[1]?.trim();
		if (more) lines.push("", section ?? "Its doc has no ## Usage section.");
		lines.push("", usageHelp.pointer("pass", more));
		ctx.out(lines.join("\n"));
		return;
	}
	const matched = new Map<Usage, Args>();
	for (const usage of usages) {
		try {
			matched.set(usage, matchUsage([usage.text], ["pass", ...argv]).args);
		} catch {
			// Only the usages the command line matches count.
		}
	}
	const first = matched.entries().next().value;
	if (!first) throw new Error(`no gate usage matches \`pass ${argv.join(" ")}\`; usages:\n${listing}`);
	const sect = first[0].sect;
	// The sect's option binds the quid; each gate gets the rest of what its usage bound.
	const key = sect.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
	const quid = sectValue(String(first[1][key]), ctx.cwd, bridge).toLowerCase();
	if (!QUID.test(quid)) throw new Error(`not a quid: ${quid}`);

	const edit = editKbDocs(ctx.cwd, core.version, ctx.capes, (warning) => ctx.err(`nosedive: ${warning}`));
	const doc = edit.doc(quid);
	const { spelling: kind, kind: declared, identity } = kindOfDoc(doc, bridge, all);
	const name = String(doc.fm.name);
	const ids = [...new Set([...gateIds(declared?.links, sect), ...gateIds(doc.fm.links, sect)])];
	if (ids.length === 0) throw new Error(`${name} links no ${sect}.gate, nor does its kind ${kind}`);

	const linked = ids.map((id) => {
		const own = usages.filter((usage) => usage.docId === id && usage.sect === sect);
		if (own.length === 0) throw new Error(`gate ${id} is in no built cape, so nothing was run`);
		return own;
	});
	const runs = linked.flatMap((own) => {
		// A bare kind in a usage is its cape's own; any other spelling is read in this hero's terms.
		const takes = (candidate: Usage) => {
			if (candidate.kind === undefined) return true;
			const wanted = candidate.kind.includes(":") ? findKind(candidate.kind, bridge, all) : (candidate.cape.kinds[candidate.kind] as { id?: string } | undefined);
			return declared ? wanted?.id === declared.id : candidate.kind === identity.name;
		};
		const usage = own.find((candidate) => matched.has(candidate) && takes(candidate));
		return usage ? [usage] : [];
	});
	if (runs.length === 0) {
		const theirs = linked.flat().map((usage) => `  ${usage.text}`);
		throw new Error(`no ${sect} gate ${name} passes through takes \`pass ${argv.join(" ")}\` for a ${kind}; their usages:\n${theirs.join("\n")}`);
	}

	// Whatever fails from here on, the docs gates minted go again (gate-mints-roll-back).
	const minted: string[] = [];
	const mint: GateCtx["mint"] = (kbDir, fields) => {
		const made = mintKbDoc(kbDir, fields);
		minted.push(made.path);
		// The pass's edit finds only docs git tracks.
		const added = spawnSync("git", ["add", "-N", "--", made.path], { cwd: kbDir, encoding: "utf8" });
		if (added.status !== 0) throw new Error(`git add -N ${made.path}: ${(added.stderr || added.stdout).trim()}`);
		return made;
	};
	const heard: Committed[] = [];
	try {
		await runGates(runs, matched, key, { core, capes, bridge, doc, edit, mint }, heard, ctx);
		const written = edit.commit({ action: "pass", what: sect });
		if (written.length > 0) ctx.out(written.join("\n"));
	} catch (error) {
		discardMinted(minted);
		throw error;
	}
	// The commit is made, so a failing fn leaves it, and the fns after it still run.
	const failures: string[] = [];
	if (edit.commits.length > 0) {
		for (const fn of heard) {
			try {
				await fn([...edit.commits]);
			} catch (error) {
				failures.push(error instanceof Error ? error.message : String(error));
			}
		}
	}
	if (failures.length > 0) throw new Error(`committed, but ${failures.length} committed callback(s) failed: ${failures.join("; ")}`);
}

/** What a gate asked to be called with the pass's commits. */
type Committed = Parameters<NonNullable<GateCtx["committed"]>>[0];

async function runGates(runs: Usage[], matched: Map<Usage, Args>, key: string, shared: Pick<GateCtx, "core" | "capes" | "bridge" | "doc" | "edit" | "mint">, heard: Committed[], ctx: Ctx): Promise<void> {
	const { core, capes, bridge, doc, edit, mint } = shared;
	for (const usage of runs) {
		const args = { ...matched.get(usage)! };
		delete args[key];
		const gate: GateCtx = {
			core,
			capes,
			bridge,
			doc,
			args,
			edit,
			mint,
			committed: (fn) => void heard.push(fn),
			crud: (target, field, value) => crudEdit(edit, target, field, value, ctx),
			out: ctx.out,
			err: ctx.err,
		};
		const entry = usage.cape.index[namespacedUuid(usage.docId, usage.cape.id)];
		try {
			if (typeof entry !== "function") throw new Error(`${usage.cape.name} has no entrypoint for it`);
			await entry({ usage: `u${usage.id}`, args, ctx, gate });
		} catch (error) {
			throw new Error(`gate ${usage.doc.name} failed, so nothing was written: ${error instanceof Error ? error.message : String(error)}`);
		}
		ctx.out(`gate ${usage.doc.name}: passed`);
	}
}

/** The gate usages under each kind that links their gate as `<sect>.gate`, by the kind's spelling, then the rest under `any doc`. */
function groupedListing(usages: Usage[], bridge: Bridge, capes: Cape[], more: boolean): string {
	const kinds = listKinds(bridge, capes).flatMap((group) => group.kinds);
	const groups = new Map<string, Map<string, Usage>>();
	for (const usage of usages) {
		const linking = kinds.filter((kind) => gateIds((kind.meta as { links?: unknown }).links, usage.sect).includes(usage.docId));
		for (const name of linking.length > 0 ? linking.map((kind) => kind.spellings[0]!) : [ANY]) groups.set(name, (groups.get(name) ?? new Map()).set(usage.text, usage));
	}
	const names = [...groups.keys()].sort((a, b) => Number(a === ANY) - Number(b === ANY) || a.localeCompare(b));
	return names.map((name) => [name, ...[...groups.get(name)!].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).flatMap(([, usage]) => usageHelp.lines(usage, more))].join("\n")).join("\n\n");
}

/** What a sect's option holds: a quid, or the path of a directory of the hero seeded on its own, read as the quid of its primary root. */
function sectValue(given: string, cwd: string, bridge: Bridge): string {
	const dir = resolve(cwd, given);
	if (!existsSync(dir) || !statSync(dir).isDirectory()) return given;
	const root = localCapes(bridge).find((cape) => relative(cape.dir, dir) === "")?.id;
	if (!root) throw new Error(`${given} is a directory, but no local cape of the hero (a cape root its config roots list): seed one with \`nosedive --at ${given} seed --root-kind cape\``);
	return root;
}

/** The ids of the docs a links list names as `<sect>.gate`, in order. */
function gateIds(links: unknown, sect: string): string[] {
	if (!Array.isArray(links)) return [];
	return links.flatMap((link) =>
		link && typeof link === "object"
			? Object.entries(link as Record<string, { rel?: unknown } | null>)
					.filter(([, value]) => value?.rel === `${sect}.gate`)
					// The gate's quid is the key's last: one keyed `<repo id>:kb/<gate>.md` names its repo first.
					.flatMap(([target]) => target.match(new RegExp(QUID, "g"))?.at(-1) ?? [])
			: [],
	);
}

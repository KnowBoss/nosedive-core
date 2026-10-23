import { i01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./i01a1335480147d0686528aee80f8ee34.ts";
import { i01a1335482437c9eb145885f65f12aa1 as matchUsage } from "./i01a1335482437c9eb145885f65f12aa1.ts";
import { i01a1337c825f7457b879d5c039ffeccd as findCape } from "./i01a1337c825f7457b879d5c039ffeccd.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
import { i01a14fb092177d36a478d40a47166c97 as gateUsage } from "./i01a14fb092177d36a478d40a47166c97.ts";
import { i01a14fb79db47f8b94d5196027008697 as buildBase } from "./i01a14fb79db47f8b94d5196027008697.ts";
import { i01a1335487e477549d84a6fc2c901bf6 as describeCapeSource } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
import { i01a13a6aba3a763595bd67a4ee4d47bf as findRoot } from "./i01a13a6aba3a763595bd67a4ee4d47bf.ts";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import type { EditedDoc, KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";

export type Ctx = {
	cwd: string;
	out(text: string): void;
	err(text: string): void;
	stdin(): Promise<string>;
	capes: Cape[];
};

export type Args = Record<string, string | string[] | boolean | undefined>;

/** `gate` is set when pass calls a gate: what its usage impl takes. */
export type ActionCall = { usage: string; args: Args; ctx: Ctx; gate?: GateCtx };

export type CapeDoc = {
	kind: "action" | "function";
	name: string;
	gist: string;
	usages: { id: string; text: string }[];
	/** False for an action under another action: it runs by name, and help does not list it. */
	top: boolean;
	/** The whole doc, frontmatter included. */
	text: string;
	body: string;
};

export type Cape = {
	id: string;
	name: string;
	commit: string;
	version: string;
	docs: Record<string, CapeDoc>;
	index: Record<string, unknown>;
	/** Each kind the cape declares: its name, to its declaration's meta (schema, durable) and links. */
	kinds: Record<string, unknown>;
	/** A module exporting the cape's functions by their ids, for code running outside this process. */
	url?: string;
};

/** What a gate is called with when a doc passes through it. It throws to fail, and nothing the pass edited is written. */
export type GateCtx = {
	core: Cape;
	/** Every configured cape that is built; core is `core`. */
	capes: Cape[];
	bridge: Bridge;
	/** The doc passing through, as the pass's edit holds it; `doc.repoDir` is the repo it lives in. */
	doc: EditedDoc;
	/** What the gate's usage matched, besides the sect and its quid. */
	args: Args;
	edit: KbEdit;
	/** Applies one crud edit, named as its flag, in the pass's edit: `crud(quid, "meta", { trunk: "main" })`. */
	crud(quid: string, key: string, value: unknown): void;
	out(text: string): void;
	err(text: string): void;
};

/** Runs one command line, core's actions first and never shadowed; returns the exit code. */
export async function i01a1336a958f71c7beec4db3195c7966(argv: string[], ctx: Ctx): Promise<number> {
	try {
		// <cape>:<action> picks whose action runs: core's, the ship's own, or a configured cape's.
		const prefixed = /^([^:]+):([^:]+)$/.exec(argv[0] ?? "");
		const only = prefixed?.[1];
		if (prefixed) argv = [prefixed[2]!, ...argv.slice(1)];
		const [name, ...rest] = argv;
		if (name === undefined || name === "help" || name === "--help") {
			ctx.out(await renderActions(ctx));
			return 0;
		}
		const core = ctx.capes[0]!;
		let found = !only || only === core.name ? findAction([core], name) : undefined;
		if (only === core.name && !found) throw new Error(`${core.name} has no action ${name}`);
		const bridge = found ? undefined : findBridge(ctx.cwd);
		const base = bridge && (!only || only === findRoot(bridge.dir)?.fm.name) ? await buildBase(bridge, core) : undefined;
		if (base) {
			found = findAction([base], name);
			if (found) ctx.capes = [core, base, ...ctx.capes.slice(1)];
			else if (only) throw new Error(`${only} has no action ${name}`);
		}
		if (!found) {
			const cape = await findCape(ctx, name, core, only);
			if (cape) {
				ctx.capes = [...ctx.capes, cape];
				found = findAction([cape], name);
				if (!found) throw new Error(`the ${cape.name} cape was built with ${name}, but its bundle has no such action`);
			}
		}
		if (!found) throw new Error(`unknown action: ${name}\n\n${await renderActions(ctx)}`);
		const { cape, docId, doc } = found;
		if (gateUsage(doc.usages[0]?.text ?? "")) throw new Error(`${name} is a gate: \`nosedive ${doc.usages[0]!.text}\``);
		// An action that takes its command line as it is reads its own --help.
		const raw = doc.usages.some((usage) => /<argv>\.\.\.\]?$/.test(usage.text));
		if (!raw && (rest[0] === "--help" || rest[0] === "--more")) {
			ctx.out(renderHelp(doc, rest[0] === "--more"));
			return 0;
		}
		const matched = matchUsage(
			doc.usages.map((usage) => usage.text),
			argv,
		);
		const entry = cape.index[namespacedUuid(docId, cape.id)];
		if (typeof entry !== "function") throw new Error(`${cape.name} has no entrypoint for ${name}`);
		await entry({ usage: `u${doc.usages[matched.index]!.id}`, args: matched.args, ctx });
		return 0;
	} catch (err) {
		ctx.err(`nosedive: ${err instanceof Error ? err.message : String(err)}`);
		return 1;
	}
}

/** The ctx of a real command line: this process's cwd and stdio. */
export function consoleCtx(capes: Cape[]): Ctx {
	return {
		cwd: process.cwd(),
		capes,
		out: (text) => process.stdout.write(`${text}\n`),
		err: (text) => process.stderr.write(`${text}\n`),
		stdin: async () => {
			let text = "";
			for await (const chunk of process.stdin) text += chunk;
			return text;
		},
	};
}

function findAction(capes: Cape[], name: string) {
	for (const cape of capes) {
		const docId = cape.index[namespacedUuid(name, cape.id)];
		if (typeof docId !== "string") continue;
		const doc = cape.docs[docId];
		if (doc?.kind === "action") return { cape, docId, doc };
	}
	return undefined;
}

/** Core's top-level actions, then each configured cape's, as its build recorded them, grouped by cape. */
async function renderActions(ctx: Ctx): Promise<string> {
	const core = ctx.capes[0]!;
	const groups: [string, [string, string][]][] = [];
	const coreRows = Object.values(core.docs).flatMap((doc): [string, string][] => (doc.top && doc.kind === "action" && !gateUsage(doc.usages[0]?.text ?? "") ? [[doc.name, doc.gist]] : []));
	groups.push([core.name, coreRows]);
	const bridge = findBridge(ctx.cwd);
	// The ship's own commands, read from its docs: listing them needs no build.
	const root = bridge && findRoot(bridge.dir);
	if (bridge && root?.bridge.workspace !== undefined) {
		const rows = Object.values(describeCapeSource(bridge.dir, true).docs).flatMap((doc): [string, string][] =>
			doc.top && doc.kind === "action" && !gateUsage(doc.usages[0]?.text ?? "") && !coreRows.some(([taken]) => taken === doc.name) ? [[doc.name, doc.gist]] : [],
		);
		if (rows.length > 0) groups.push([String(root.fm.name), rows]);
	}
	for (const cape of bridge ? configuredCapes(bridge, core) : []) {
		// Core's actions are never shadowed, so a cape's action of the same name is not listed.
		const rows = Object.entries(cape.build?.actions ?? {}).filter(([name]) => !coreRows.some(([taken]) => taken === name));
		groups.push([cape.name, cape.build ? rows : [["", "not built: run `nosedive seed`"]]]);
	}
	const width = Math.max(0, ...groups.flatMap(([, rows]) => rows.map(([name]) => name.length)));
	const lines = groups.flatMap(([name, rows]) => [
		"",
		name,
		...rows.sort(([a], [b]) => a.localeCompare(b)).map(([action, gist]) => (action ? `  ${action.padEnd(width)}  ${gist}` : `  ${gist}`)),
	]);
	return ["Usage: nosedive <action> [<args>]", ...lines, "", "nosedive <action> --help for its usages."].join("\n");
}

function renderHelp(doc: CapeDoc, more: boolean): string {
	const lines = [doc.gist, "", ...doc.usages.map((usage) => `  ${usage.text}`)];
	if (more) lines.push("", doc.body);
	return lines.join("\n");
}

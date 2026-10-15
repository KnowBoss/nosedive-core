import { a01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./a01a1335480147d0686528aee80f8ee34.ts";
import { a01a1335482437c9eb145885f65f12aa1 as matchUsage } from "./a01a1335482437c9eb145885f65f12aa1.ts";
import { a01a1337c825f7457b879d5c039ffeccd as findCape } from "./a01a1337c825f7457b879d5c039ffeccd.ts";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./a01a141f869bf7f76b5bc81aa991ff9b9.ts";

export type Ctx = {
	cwd: string;
	out(text: string): void;
	err(text: string): void;
	stdin(): Promise<string>;
	capes: Cape[];
};

export type Args = Record<string, string | string[] | boolean | undefined>;

export type ActionCall = { usage: string; args: Args; ctx: Ctx };

export type CapeDoc = {
	kind: "action" | "gate";
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
	/** Each kind the cape declares: its name, to its meta schema. */
	kinds: Record<string, unknown>;
	/** A module exporting the cape's functions by their ids, for code running outside this process. */
	url?: string;
};

/** What a gate is called with. It throws to fail. */
export type GateCtx = {
	core: Cape;
	/** The repo the gate checks. */
	repoDir: string;
	bridgeDir: string;
	out(text: string): void;
	err(text: string): void;
};

/** Runs one command line, core's actions first and never shadowed; returns the exit code. */
export async function a01a1336a958f71c7beec4db3195c7966(argv: string[], ctx: Ctx): Promise<number> {
	try {
		const [name, ...rest] = argv;
		if (name === undefined || name === "help" || name === "--help") {
			ctx.out(await renderActions(ctx));
			return 0;
		}
		let found = findAction(ctx.capes, name);
		if (!found) {
			const cape = await findCape(ctx, name, ctx.capes[0]!);
			if (cape) {
				ctx.capes = [...ctx.capes, cape];
				found = findAction([cape], name);
				if (!found) throw new Error(`the ${cape.name} cape was built with ${name}, but its bundle has no such action`);
			}
		}
		if (!found) throw new Error(`unknown action: ${name}\n\n${await renderActions(ctx)}`);
		const { cape, docId, doc } = found;
		if (rest[0] === "--help" || rest[0] === "--more") {
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
		if (doc && doc.usages.length > 0) return { cape, docId, doc };
	}
	return undefined;
}

/** Core's top-level actions, then those of each configured cape, as its build recorded them. */
async function renderActions(ctx: Ctx): Promise<string> {
	const core = ctx.capes[0]!;
	const rows = new Map<string, string>();
	for (const doc of Object.values(core.docs)) if (doc.top && doc.usages.length > 0) rows.set(doc.name, doc.gist);
	const bridge = findBridge(ctx.cwd);
	for (const cape of bridge ? configuredCapes(bridge, core) : []) {
		if (!cape.build) rows.set(cape.name, "cape not built: run `nosedive seed`");
		for (const [name, gist] of Object.entries(cape.build?.actions ?? {})) if (!rows.has(name)) rows.set(name, `${gist} (${cape.name})`);
	}
	const width = Math.max(0, ...[...rows.keys()].map((name) => name.length));
	const lines = [...rows]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([name, gist]) => `  ${name.padEnd(width)}  ${gist}`);
	return ["Usage: nosedive <action> [<args>]", "", ...lines, "", "nosedive <action> --help for its usages."].join("\n");
}

function renderHelp(doc: CapeDoc, more: boolean): string {
	const lines = [doc.gist, "", ...doc.usages.map((usage) => `  ${usage.text}`)];
	if (more) lines.push("", doc.body);
	return lines.join("\n");
}

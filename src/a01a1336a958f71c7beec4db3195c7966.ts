import { a01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./a01a1335480147d0686528aee80f8ee34.ts";
import { a01a1335482437c9eb145885f65f12aa1 as matchUsage } from "./a01a1335482437c9eb145885f65f12aa1.ts";

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
	name: string;
	gist: string;
	usages: { id: string; text: string }[];
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
};

/** Runs one command line against the capes in `ctx`, first match wins; returns the exit code. */
export async function a01a1336a958f71c7beec4db3195c7966(argv: string[], ctx: Ctx): Promise<number> {
	try {
		const [name, ...rest] = argv;
		if (name === undefined || name === "help" || name === "--help") {
			ctx.out(renderActions(ctx.capes));
			return 0;
		}
		const found = findAction(ctx.capes, name);
		if (!found) throw new Error(`unknown action: ${name}\n\n${renderActions(ctx.capes)}`);
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

function renderActions(capes: Cape[]): string {
	const actions = capes.flatMap((cape) => Object.values(cape.docs).filter((doc) => doc.usages.length > 0));
	const width = Math.max(0, ...actions.map((doc) => doc.name.length));
	const lines = actions
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((doc) => `  ${doc.name.padEnd(width)}  ${doc.gist}`);
	return ["Usage: nosedive <action> [<args>]", "", ...lines, "", "nosedive <action> --help for its usages."].join("\n");
}

function renderHelp(doc: CapeDoc, more: boolean): string {
	const lines = [doc.gist, "", ...doc.usages.map((usage) => `  ${usage.text}`)];
	if (more) lines.push("", doc.body);
	return lines.join("\n");
}

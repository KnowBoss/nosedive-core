import type { Args } from "./a01a1336a958f71c7beec4db3195c7966.ts";

type Element =
	| { kind: "literal"; word: string; optional: boolean }
	| { kind: "positional"; key: string; repeat: boolean; optional: boolean }
	| { kind: "option"; flag: string; key: string; takesValue: boolean; optional: boolean };

export function a01a1335482437c9eb145885f65f12aa1(usages: string[], argv: string[]): { index: number; args: Args } {
	const matches = usages.flatMap((usage, index) => {
		const args = matchOne(parseUsage(usage), argv);
		return args ? [{ index, args }] : [];
	});
	const listing = usages.map((usage) => `  ${usage}`).join("\n");
	if (matches.length === 1) return matches[0]!;
	if (matches.length === 0) throw new Error(`no usage matches \`${argv.join(" ")}\`; usages:\n${listing}`);
	throw new Error(`\`${argv.join(" ")}\` matches more than one usage:\n${listing}`);
}

function parseUsage(usage: string): Element[] {
	const tokens = (usage.match(/\[|\]|[^\s[\]]+/g) ?? []).flatMap((token) =>
		token.length > 3 && token.endsWith("...") ? [token.slice(0, -3), "..."] : [token],
	);
	const elements: Element[] = [];
	let depth = 0;
	for (let i = 0; i < tokens.length; i += 1) {
		const token = tokens[i]!;
		const optional = depth > 0;
		if (token === "[") depth += 1;
		else if (token === "]") depth -= 1;
		else if (token === "...") {
			const last = elements.at(-1);
			if (last?.kind !== "positional") throw new Error(`\`...\` must follow an <argument> in: ${usage}`);
			last.repeat = true;
		} else if (token.startsWith("--")) {
			const [flag, inline] = token.split("=", 2) as [string, string | undefined];
			const takesValue = inline !== undefined || /^<.+>$/.test(tokens[i + 1] ?? "");
			if (takesValue && inline === undefined) i += 1;
			elements.push({ kind: "option", flag, key: keyOf(flag), takesValue, optional });
		} else if (/^<.+>$/.test(token)) {
			elements.push({ kind: "positional", key: keyOf(token), repeat: false, optional });
		} else {
			elements.push({ kind: "literal", word: token, optional });
		}
	}
	if (depth !== 0) throw new Error(`unbalanced brackets in: ${usage}`);
	return elements;
}

function keyOf(token: string): string {
	return token
		.replace(/^<|>$/g, "")
		.replace(/^-+/, "")
		.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function matchOne(elements: Element[], argv: string[]): Args | undefined {
	const options = elements.filter((element) => element.kind === "option");
	const args: Args = {};
	for (const option of options) args[option.key] = option.takesValue ? undefined : false;

	const positionals: string[] = [];
	for (let i = 0; i < argv.length; i += 1) {
		const token = argv[i]!;
		if (!token.startsWith("--") || token.length === 2) {
			positionals.push(token);
			continue;
		}
		const [flag, inline] = token.split("=", 2) as [string, string | undefined];
		const option = options.find((candidate) => candidate.flag === flag);
		if (!option || args[option.key] !== undefined && args[option.key] !== false) return undefined;
		if (!option.takesValue) {
			if (inline !== undefined) return undefined;
			args[option.key] = true;
		} else if (inline !== undefined) {
			args[option.key] = inline;
		} else {
			const value = argv[i + 1];
			if (value === undefined) return undefined;
			args[option.key] = value;
			i += 1;
		}
	}
	if (options.some((option) => !option.optional && (args[option.key] === undefined || args[option.key] === false))) {
		return undefined;
	}

	const sequence = elements.filter((element) => element.kind !== "option");
	const bound = bind(sequence, positionals, 0, 0);
	if (!bound) return undefined;
	for (const element of sequence) if (element.kind === "positional") args[element.key] = bound[element.key];
	return args;
}

type Bindings = Record<string, string | string[] | undefined>;

function bind(sequence: Element[], tokens: string[], at: number, from: number): Bindings | undefined {
	if (at === sequence.length) return from === tokens.length ? {} : undefined;
	const element = sequence[at]!;
	const skip = () => (element.optional ? bind(sequence, tokens, at + 1, from) : undefined);
	if (element.kind === "literal") {
		if (tokens[from] === element.word) return bind(sequence, tokens, at + 1, from + 1) ?? skip();
		return skip();
	}
	if (element.kind !== "positional") return undefined;
	const most = element.repeat ? tokens.length - from : Math.min(1, tokens.length - from);
	for (let take = most; take >= 1; take -= 1) {
		const rest = bind(sequence, tokens, at + 1, from + take);
		if (rest) {
			const values = tokens.slice(from, from + take);
			return { ...rest, [element.key]: element.repeat ? values : values[0] };
		}
	}
	return skip();
}

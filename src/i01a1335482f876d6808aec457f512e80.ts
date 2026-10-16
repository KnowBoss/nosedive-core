import { parseDocument, type Document } from "yaml";

export type KbDoc = {
	/** The frontmatter as plain data. */
	fm: Record<string, unknown>;
	/** The frontmatter as YAML, so a write changes only what was set. */
	yaml: Document;
	/** Everything after the frontmatter's closing line. */
	body: string;
};

export function i01a1335482f876d6808aec457f512e80(text: string, label = "kb doc"): KbDoc {
	const match = /^---\r?\n([\s\S]*?\r?\n)?---\r?\n?/.exec(text);
	if (!match) throw new Error(`${label} has no frontmatter`);
	const yaml = parseDocument(match[1] ?? "");
	if (yaml.errors.length > 0) throw new Error(`${label}: ${yaml.errors[0]!.message}`);
	const fm = yaml.toJS() as unknown;
	if (fm === null || typeof fm !== "object" || Array.isArray(fm)) throw new Error(`${label} frontmatter is not a mapping`);
	return { fm: fm as Record<string, unknown>, yaml, body: text.slice(match[0].length) };
}

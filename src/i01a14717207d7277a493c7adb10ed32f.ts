/** The title is the first non-blank line, when it is a `# ` heading; `under` is everything after it. */
export function i01a14717207d7277a493c7adb10ed32f(body: string): { title: string; under: string } | undefined {
	const match = /^\s*# (.+)\r?\n?/.exec(body);
	if (!match) return undefined;
	return { title: match[1]!.trim(), under: body.slice(match[0].length) };
}

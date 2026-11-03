import { spawnSync } from "node:child_process";

const CO_AUTHOR = /^Co-Authored-By: nosedive .*<noreply@nosedive\.dev>\s*$/i;

/** The trailer saying a core of this version made a commit. */
export function coAuthor(version: string): string {
	return `Co-Authored-By: nosedive ${version} <noreply@nosedive.dev>`;
}

/** Whether a trailer line is a nosedive co-author, of any version. */
export function isCoAuthor(trailer: string): boolean {
	return CO_AUTHOR.test(trailer);
}

/** Whether a commit message carries a nosedive co-author, of any version. */
export function hasCoAuthor(message: string): boolean {
	return message.split(/\r?\n/).some(isCoAuthor);
}

/** The message with the nosedive co-author trailer, which joins the message's trailers; a message that has one is returned as it is. */
export function i01a19005c31172b68871d4842563d310(message: string, version: string): string {
	if (hasCoAuthor(message)) return message;
	// Git before 2.44 puts the trailer straight under a last line that has no newline, with no blank line, so it would join the subject.
	const input = message.endsWith("\n") ? message : `${message}\n`;
	const result = spawnSync("git", ["interpret-trailers", "--if-exists", "add", "--trailer", coAuthor(version)], { encoding: "utf8", input });
	if (result.status !== 0) throw new Error(`git interpret-trailers failed: ${(result.stderr || result.error?.message || "").trim()}`);
	return result.stdout;
}

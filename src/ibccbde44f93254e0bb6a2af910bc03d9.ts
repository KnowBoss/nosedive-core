import { dirname, relative, resolve } from "node:path";
import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { findDoc } from "./if4a09298430355a2a473394fbb5103f2.ts";

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
/** A code span, matched so it is skipped, or an inline link's target, bare or in angle brackets. */
const SPAN_OR_LINK = /(`+).*?\1|(\]\(\s*)(<[^>]*>|[^)\s]+)/g;
/** A reference definition, `[label]: target`; a footnote's, `[^1]: text`, is none. */
const DEFINITION = /^(\s{0,3}\[(?!\^)[^\]]+\]:\s+)(<[^>]*>|\S+)/;
/** A target to leave as written: one with a scheme (a cross-repo `<repo>:<path>` too), a bare anchor, or an absolute path. */
const KEPT = /^(?:[a-z][a-z0-9+.-]*:|#|[\\/])/i;

/** A doc with no file on disk, as one from a shipped build is, has nowhere to resolve its links from: they are printed as written. */
export async function ibccbde44f93254e0bb6a2af910bc03d9(quid: string, ctx: Ctx): Promise<void> {
	const doc = await findDoc(quid, ctx);
	const body = readKbDoc(doc.text).body.trim();
	ctx.out(doc.path ? relinked(body, dirname(doc.path), ctx.cwd) : body);
}

/** `body` with each relative link target, written relative to `from`, rewritten relative to `to`; code spans and fenced blocks are left alone. */
export function relinked(body: string, from: string, to: string): string {
	let fence: string | undefined;
	return body
		.split("\n")
		.map((line) => {
			const mark = FENCE.exec(line)?.[1];
			if (fence) {
				if (mark && mark[0] === fence[0] && mark.length >= fence.length) fence = undefined;
				return line;
			}
			if (mark) {
				fence = mark;
				return line;
			}
			const definition = DEFINITION.exec(line);
			if (definition) return `${definition[1]}${retarget(definition[2]!, from, to)}${line.slice(definition[0].length)}`;
			return line.replace(SPAN_OR_LINK, (match, _ticks, open?: string, target?: string) => (target === undefined ? match : `${open}${retarget(target, from, to)}`));
		})
		.join("\n");
}

function retarget(target: string, from: string, to: string): string {
	const angled = target.startsWith("<");
	const raw = angled ? target.slice(1, -1) : target;
	if (KEPT.test(raw)) return target;
	const hash = raw.indexOf("#");
	const path = hash === -1 ? raw : raw.slice(0, hash);
	const moved = `${(relative(to, resolve(from, path)) || ".").replace(/\\/g, "/")}${hash === -1 ? "" : raw.slice(hash)}`;
	// A path with a space is a link target only in angle brackets.
	return angled || /\s/.test(moved) ? `<${moved}>` : moved;
}

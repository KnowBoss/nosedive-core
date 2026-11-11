import { existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import type { Cape, Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { dockAt, dockPath, heroOf, reposOf } from "./i9dfd0b735ec95af1948f2b3311749c52.ts";
import { docFile, findDoc } from "./if4a09298430355a2a473394fbb5103f2.ts";

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
/** A code span, matched so it is skipped, or an inline link's target, bare or in angle brackets. */
const SPAN_OR_LINK = /(`+).*?\1|(\]\(\s*)(<[^>]*>|[^)\s]+)/g;
/** A reference definition, `[label]: target`; a footnote's, `[^1]: text`, is none. */
const DEFINITION = /^(\s{0,3}\[(?!\^)[^\]]+\]:\s+)(<[^>]*>|\S+)/;
/** A target to leave as written: one with a scheme (a cross-repo `<repo>:<path>` too), a bare anchor, or an absolute path. */
const KEPT = /^(?:[a-z][a-z0-9+.-]*:|#|[\\/])/i;

/**
 * A doc with a file has its links resolved from it. One a cape ships without a file is looked up in the cape's repo, docked read-only at
 * the commit the cape was built at (read-docks-capes), and its links resolve into the dock; where it cannot be, they are printed as written.
 */
export async function ibccbde44f93254e0bb6a2af910bc03d9(quid: string, ctx: Ctx): Promise<void> {
	const doc = await findDoc(quid, ctx);
	const body = readKbDoc(doc.text).body.trim();
	const file = doc.path ?? (doc.cape ? dockedFile(doc.cape, quid, ctx) : undefined);
	ctx.out(file ? relinked(body, dirname(file), ctx.cwd) : body);
}

/** A cape doc's file in its repo's dock, docked first when the dock is not there; undefined, with a line on stderr why, when it cannot be. */
function dockedFile(cape: Cape, quid: string, ctx: Ctx): string | undefined {
	try {
		const hero = heroOf(ctx);
		const repos = reposOf(hero).filter((doc) => doc.fm.name === cape.name);
		if (repos.length !== 1) throw new Error(`the hero has ${repos.length === 0 ? "no repo doc" : `${repos.length} repo docs`} named ${cape.name}`);
		const at = dockPath(hero, repos[0]!);
		// A dock there that holds the doc is used as it is: the pilot may have docked it at another head.
		if (!existsSync(docFile(at, quid))) {
			dockAt(hero, repos[0]!, cape.commit, ctx);
			if (!existsSync(docFile(at, quid))) throw new Error(`${at} does not hold the doc`);
		}
		return docFile(at, quid);
	} catch (error) {
		ctx.err(`nosedive: cannot dock ${cape.name} at ${cape.commit.slice(0, 12)} to resolve the links of ${quid}, so they are as written: ${(error as Error).message.replace(/\s*\n\s*/g, "; ")}`);
		return undefined;
	}
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

import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { relative, resolve, join } from "node:path";
import { i01a19005c31172b68871d4842563d310 as coAuthored } from "./i01a19005c31172b68871d4842563d310.ts";
import { scopeEntries } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc, kingsmetal } from "./i01a1335483aa776cb84df698b04adc06.ts";
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import type { KbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge, type Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { i01a19005c109715583553072f4e38dc4 as commitSubject } from "./i01a19005c109715583553072f4e38dc4.ts";

export type EditedDoc = KbDoc & { id: string; path: string; text: string; repoDir: string; kbDir: string };

export type KbEdit = {
	bridge: Bridge;
	/** Finds a doc once per edit; later calls see earlier changes. */
	doc(id: string): EditedDoc;
	/** Marks a doc to be written. */
	change(doc: EditedDoc): void;
	/** The crud edits applied, by name, in order; they name the commit's `what` unless it is given one. */
	edits: string[];
	/** Writes the changed docs, commits each repo's (as `subject` when given: `crud <edits>` by default), and returns their paths relative to the bridge. */
	commit(subject?: { action: string; what: string }): string[];
	/** When set, kind and meta edits leave their schema check to the caller, collecting the docs here. */
	unchecked?: Set<EditedDoc>;
};

/** `version` is the core's, named in the co-author trailer of its commits. */
export function i01a14ab1d36771eea2bc6f13bdeb0526(cwd: string, version: string, options: { exclusive?: boolean } = {}): KbEdit {
	const bridge = findBridge(cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const docs = new Map<string, EditedDoc>();
	const changed = new Set<EditedDoc>();
	const edits: string[] = [];
	// Keep preconditions separate from the mutable documents callers edit.
	const originals = new Map<EditedDoc, { path: string; repo: string; content: Buffer; identity: string; index: string }>();
	const heads = new Map<string, string>();
	const conflict = (message: string) => Object.assign(new Error(message), { code: "REPOSITORY_CHANGED", status: 409, outcome: "not_applied" });
	const git = (repo: string, ...args: string[]) => {
		const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
		if (result.status !== 0) throw conflict(`Cannot verify the repository before saving: ${result.stderr || result.error?.message || args[0]}`);
		return result.stdout;
	};
	const identity = (path: string) => {
		const stat = lstatSync(path, { bigint: true });
		return JSON.stringify([realpathSync(path), ...[stat.dev, stat.ino, stat.mode, stat.size, stat.mtimeNs, stat.ctimeNs].map(String)]);
	};
	return {
		bridge,
		edits,
		doc(id) {
			const known = docs.get(id);
			if (known) return known;
			const found = locateKbDoc(bridge, id);
			if (!found) throw new Error(`no doc ${id} in the bridge or its workspace`);
			const tracked = spawnSync("git", ["ls-files", "--error-unmatch", "--", found.path], { cwd: found.repoDir, encoding: "utf8" });
			if (tracked.status !== 0) throw new Error(`${id} is not tracked by git in ${found.repoDir}, so crud does not edit it`);
			const doc = { ...found, id };
			try {
				const before = identity(doc.path);
				const content = readFileSync(doc.path);
				if (content.toString("utf8") !== doc.text || identity(doc.path) !== before) throw conflict(`${id} changed while it was being opened; read the latest document before saving.`);
				const head = git(doc.repoDir, "rev-parse", "HEAD");
				if (heads.has(doc.repoDir) && heads.get(doc.repoDir) !== head) throw conflict("The repository changed while preparing this edit; read the latest state before saving.");
				heads.set(doc.repoDir, head);
				originals.set(doc, { path: doc.path, repo: doc.repoDir, content, identity: before, index: git(doc.repoDir, "ls-files", "--stage", "--", doc.path) });
			} catch (error) {
				if ((error as { code?: string }).code === "REPOSITORY_CHANGED") throw error;
				throw conflict(`${id} became unavailable while opening it; read the latest state before saving.`);
			}
			docs.set(id, doc);
			return doc;
		},
		change(doc) {
			if (!originals.has(doc)) throw conflict("This document was not opened by this edit; open it before changing it.");
			changed.add(doc);
		},
		commit(given) {
			// Validate the entire read set before writing any repository, including unchanged
			// documents whose contents informed this operation. This is optimistic validation,
			// not an OS lock against an editor writing after these checks.
			for (const [repo, head] of heads) if (git(repo, "rev-parse", "HEAD") !== head) throw conflict("The repository changed while preparing this edit; read the latest state before saving.");
			for (const [doc, original] of originals) {
				try {
					if (doc.path !== original.path || doc.repoDir !== original.repo || identity(doc.path) !== original.identity || !readFileSync(doc.path).equals(original.content) || identity(doc.path) !== original.identity || git(doc.repoDir, "ls-files", "--stage", "--", doc.path) !== original.index) {
						throw conflict(`${doc.id} changed while preparing this edit; read the latest document before saving.`);
					}
				} catch (error) {
					if ((error as { code?: string }).code === "REPOSITORY_CHANGED") throw error;
					throw conflict(`${doc.id} became unavailable while preparing this edit; nothing was written.`);
				}
			}
			const byRepo = new Map<string, { doc: EditedDoc; text: string }[]>();
			for (const doc of changed) {
				// A doc is refused only as it would be written, so an edit can repair one.
				scopeEntries(doc.fm.scopes);
				kingsmetal(doc.yaml);
				const text = `---\n${doc.yaml.toString({ lineWidth: 0 })}---\n${doc.body}`;
				if (text === doc.text) continue;
				byRepo.set(doc.repoDir, [...(byRepo.get(doc.repoDir) ?? []), { doc, text }]);
			}
			if (options.exclusive && byRepo.size) {
				if (process.platform !== "win32") throw conflict("Enforced file-write exclusion is unavailable on this platform; no files were written.");
				const replacements = new Map([...byRepo.values()].flat().map(({ doc, text }) => [doc, Buffer.from(text).toString("base64")]));
				const plan = {
					parent: process.pid, host: hostname(),
					leases: [...new Set([...heads.keys()].map(repo => realpathSync(resolve(repo,git(repo,"rev-parse","--git-common-dir").trim()))))].map(common => join(common,"nosedive-writers",randomUUID()+".json")),
					files: [...originals].map(([doc, original]) => ({ path: original.path, expected: original.content.toString("base64"), replacement: replacements.get(doc), index: original.index, repo: original.repo })),
					repos: [...byRepo].map(([repo, written]) => ({ repo, head: heads.get(repo), paths: written.map(({doc}) => relative(repo,doc.path).replace(/\\/g,"/")), message: coAuthored(commitSubject(bridge, given?.action ?? "crud", given?.what ?? ([...new Set(edits)].join(", ") || "edit"), written.map(({doc}) => doc.id)), version) })),
					heads: [...heads].map(([repo,head])=>({repo,head})),
				};
				const result = spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(protectedWrite, "utf16le").toString("base64")], { input: JSON.stringify(plan), encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
				let receipt: { ok?: boolean; started?: boolean; error?: string };
				try {
					receipt = JSON.parse(result.stdout);
					if (!receipt || typeof receipt.ok !== "boolean" || typeof receipt.started !== "boolean") throw new Error("Invalid writer receipt.");
				} catch { throw Object.assign(new Error(`Protected writer was not acknowledged: ${result.error?.message ?? result.stderr}`), { outcome: "unknown" }); }
				if (!receipt.ok) throw Object.assign(new Error(receipt.error?.trim() || "Protected write failed; inspect its recorded outcome before submitting again."), { status: receipt.started ? 500 : 409, outcome: receipt.started ? "unknown" : "not_applied", code: receipt.started ? "WRITE_FAILED" : "REPOSITORY_CHANGED" });
				return [...changed].map((doc) => relative(bridge.dir, doc.path).replace(/\\/g, "/"));
			}
			for (const [repoDir, written] of byRepo) {
				for (const { doc } of written) writeKbDoc(doc.path, doc.yaml, doc.body);
				const { action, what } = given ?? { action: "crud", what: [...new Set(edits)].join(", ") || "edit" };
				commitFiles(repoDir, written.map(({ doc }) => doc.path), commitSubject(bridge, action, what, written.map(({ doc }) => doc.id)), version);
			}
			return [...changed].map((doc) => relative(bridge.dir, doc.path).replace(/\\/g, "/"));
		},
	};
}

// Windows sharing rules are enforced against other processes, including editors that
// do not know about Helm. Final byte/index/HEAD validation and Git commits occur while
// all read-set handles deny write and delete sharing. Data is JSON on stdin, never code.
const protectedWrite = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::InputEncoding = New-Object Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
$streams = New-Object 'System.Collections.Generic.List[System.IO.FileStream]'
$leases = New-Object 'System.Collections.Generic.List[string]'
$parentProcess = $null
$started = $false
function Git($repo, $arguments) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & git.exe -C $repo @arguments 2>&1
  $code = $LASTEXITCODE
  $ErrorActionPreference = $previous
  if ($code -ne 0) { $reason = ($output -join [char]10); if (!$reason) { $reason = "git $($arguments[0]) failed with exit code $code" }; throw $reason }
  return ($output -join [char]10).TrimEnd([char[]]@(13,10))
}
try {
  $plan = [Console]::In.ReadToEnd() | ConvertFrom-Json
  foreach ($lease in $plan.leases) {
    $null = [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($lease))
    $owner = [Text.Encoding]::UTF8.GetBytes((@{pid=$PID;host=$plan.host;parent=$plan.parent} | ConvertTo-Json -Compress))
    $registration = New-Object IO.FileStream($lease,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    $leases.Add($lease)
    try { $registration.Write($owner,0,$owner.Length); $registration.Flush($true) } finally { $registration.Dispose() }
  }
  $parentProcess = [Diagnostics.Process]::GetProcessById([int]$plan.parent)
  if ($parentProcess.HasExited) { throw 'The requesting process exited; nothing was written.' }
  foreach ($file in $plan.files) {
    $access = [IO.FileAccess]::Read
    if ($null -ne $file.replacement) { $access = [IO.FileAccess]::ReadWrite }
    $stream = New-Object IO.FileStream($file.path, [IO.FileMode]::Open, $access, [IO.FileShare]::Read)
    $streams.Add($stream)
  }
  for ($i = 0; $i -lt $plan.files.Count; $i++) {
    $stream = $streams[$i]
    $copy = New-Object IO.MemoryStream
    try { $stream.CopyTo($copy); $actual = [Convert]::ToBase64String($copy.ToArray()) } finally { $copy.Dispose() }
    if ($actual -cne $plan.files[$i].expected) { throw 'A document changed before protected access was acquired; nothing was written.' }
    $index = Git $plan.files[$i].repo @('ls-files','--stage','--',$plan.files[$i].path)
    if ($index -cne $plan.files[$i].index.TrimEnd([char[]]@(13,10))) { throw 'The index changed before saving; nothing was written.' }
  }
  foreach ($head in $plan.heads) {
    if ((Git $head.repo @('rev-parse','HEAD')) -cne $head.head.Trim()) { throw 'HEAD changed before saving; nothing was written.' }
  }
  for ($i = 0; $i -lt $plan.files.Count; $i++) {
    if ($null -eq $plan.files[$i].replacement) { continue }
    if ($parentProcess.HasExited) { throw 'The requesting process exited during saving.' }
    $bytes = [Convert]::FromBase64String($plan.files[$i].replacement)
    $started = $true
    $streams[$i].Position = 0
    $streams[$i].Write($bytes, 0, $bytes.Length)
    $streams[$i].SetLength($bytes.Length)
    $streams[$i].Flush($true)
  }
  foreach ($repo in $plan.repos) {
    if ($parentProcess.HasExited) { throw 'The requesting process exited before commit.' }
    $spec = [IO.Path]::GetTempFileName()
    $message = [IO.Path]::GetTempFileName()
    try {
      $paths = ($repo.paths | ForEach-Object { ':(literal)' + $_ }) -join [char]0
      [IO.File]::WriteAllBytes($spec, [Text.Encoding]::UTF8.GetBytes($paths + [char]0))
      [IO.File]::WriteAllBytes($message, [Text.Encoding]::UTF8.GetBytes($repo.message))
      $null = Git $repo.repo @('add',"--pathspec-from-file=$spec",'--pathspec-file-nul')
      $null = Git $repo.repo @('commit','-q','-F',$message,"--pathspec-from-file=$spec",'--pathspec-file-nul')
    } finally { [IO.File]::Delete($spec); [IO.File]::Delete($message) }
  }
  @{ok=$true;started=$started} | ConvertTo-Json -Compress
} catch {
  @{ok=$false;started=$started;error=$_.Exception.Message} | ConvertTo-Json -Compress
} finally {
  foreach ($stream in $streams) { $stream.Dispose() }
  foreach ($lease in $leases) { [IO.File]::Delete($lease) }
  if ($null -ne $parentProcess) { $parentProcess.Dispose() }
}
`;

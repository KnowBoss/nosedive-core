// cape-manifest
import assert from "node:assert/strict";
import { test } from "node:test";
import { a01a1337c810a7456876b831d0c873396 as capeManifest } from "../src/a01a1337c810a7456876b831d0c873396.ts";
import { tempDir } from "./harness.ts";

const build = { id: "x", repo: "r", ref: "", commit: "c", core: "k", needs: {}, version: "v", builtAt: "2026-10-13T00:00:00.000Z" };

test("starts empty, records builds, and replaces a rebuild of the same id", () => {
	const bridge = tempDir("cape-manifest");
	assert.deepEqual(capeManifest(bridge), []);
	capeManifest(bridge, build);
	capeManifest(bridge, { ...build, id: "y" });
	capeManifest(bridge, { ...build, builtAt: "2026-10-14T00:00:00.000Z" });
	assert.deepEqual(
		capeManifest(bridge).map((entry) => [entry.id, entry.builtAt]),
		[
			["y", "2026-10-13T00:00:00.000Z"],
			["x", "2026-10-14T00:00:00.000Z"],
		],
	);
});

// cape-index
import assert from "node:assert/strict";
import { test } from "node:test";
import { a01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "../src/a01a1335480147d0686528aee80f8ee34.ts";
import { a01a133588c7971b5b116d9c8c1706e04 as capeIndex } from "../src/a01a133588c7971b5b116d9c8c1706e04.ts";

const CAPE = "01a1335b-f30a-7dd2-a1d4-b675fd419238";
const DOC = "01a1335b-f253-7b80-ab64-d2f9a03c9634";

test("keys the name to the doc, and the doc to its entrypoint, in the cape's id", () => {
	const index = capeIndex(
		{
			docs: { [DOC]: { name: "greet", gist: "", usages: [], top: true, text: "", body: "" } },
			entries: [{ id: DOC, name: "a01a1335bf2537b80ab64d2f9a03c9634", file: "src/a.ts" }],
		},
		CAPE,
	);
	assert.deepEqual(index, {
		names: { [namespacedUuid("greet", CAPE)]: DOC },
		entries: { [namespacedUuid(DOC, CAPE)]: { name: "a01a1335bf2537b80ab64d2f9a03c9634", file: "src/a.ts" } },
	});
});

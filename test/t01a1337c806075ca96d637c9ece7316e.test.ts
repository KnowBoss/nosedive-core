// cape-id
import assert from "node:assert/strict";
import { test } from "node:test";
import { i01a1337c806075ca96d637c9ece7316e as capeId } from "../src/i01a1337c806075ca96d637c9ece7316e.ts";

const REPO = "01a1337c-830d-7ef7-b5b2-ab0bc3a666e9";
const CORE = "01a1335b-f30a-7dd2-a1d4-b675fd419238";
const OTHER_CORE = "01a1335b-f253-7b80-ab64-d2f9a03c9634";
const COMMIT = "905ce12404aa3a109d6fae4f9f40e906fe53f7f6";

test("is fixed by repo, commit and core, and changes with each", () => {
	assert.equal(capeId(REPO, COMMIT, CORE), capeId(REPO, COMMIT, CORE));
	assert.notEqual(capeId(REPO, COMMIT, CORE), capeId(REPO, COMMIT, OTHER_CORE));
	assert.notEqual(capeId(REPO, COMMIT, CORE), capeId(CORE, COMMIT, CORE));
	assert.notEqual(capeId(REPO, COMMIT, CORE), capeId(REPO, "ce9ebbd6683d54643605bef6b360718115025cb1", CORE));
});

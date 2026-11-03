// commit-message
import assert from "node:assert/strict";
import { test } from "node:test";
import { coAuthor, hasCoAuthor, isCoAuthor, i01a19005c31172b68871d4842563d310 as commitMessage } from "./i01a19005c31172b68871d4842563d310.ts";

const TRAILER = "Co-Authored-By: nosedive 1.2.3 <noreply@nosedive.dev>";

test("ends a subject with the nosedive co-author, after a blank line", () => {
	assert.equal(coAuthor("1.2.3"), TRAILER);
	assert.equal(commitMessage("feat(x): crud links", "1.2.3"), `feat(x): crud links\n\n${TRAILER}\n`);
});

test("keeps the trailer off the subject whether or not the message ends with a newline", () => {
	assert.equal(commitMessage("add a", "1.2.3"), `add a\n\n${TRAILER}\n`);
	assert.equal(commitMessage("add a\n", "1.2.3"), `add a\n\n${TRAILER}\n`);
	assert.equal(commitMessage("add a\n\nwhy", "1.2.3"), `add a\n\nwhy\n\n${TRAILER}\n`);
});

test("joins the trailers a message has, and follows a body", () => {
	assert.equal(commitMessage("subject\n\nCo-Authored-By: Ann <ann@example.com>\n", "1.2.3"), `subject\n\nCo-Authored-By: Ann <ann@example.com>\n${TRAILER}\n`);
	assert.equal(commitMessage("subject\n\nwhy\n", "1.2.3"), `subject\n\nwhy\n\n${TRAILER}\n`);
});

test("leaves a message that has one as it is, whatever its version", () => {
	const message = "subject\n\nCo-Authored-By: nosedive 0.0.9 <noreply@nosedive.dev>\n";
	assert.equal(commitMessage(message, "1.2.3"), message);
	assert.equal(commitMessage(commitMessage("subject", "1.2.3"), "9.9.9"), `subject\n\n${TRAILER}\n`, "adding it twice adds it once");
});

test("tells a nosedive co-author from any other trailer", () => {
	assert.equal(isCoAuthor(TRAILER), true);
	assert.equal(isCoAuthor("Co-Authored-By: Claude <noreply@anthropic.com>"), false);
	assert.equal(isCoAuthor("Nosedive-Dive: 01a15bb1"), false);
	assert.equal(hasCoAuthor(`subject\n\n${TRAILER}\n`), true);
	assert.equal(hasCoAuthor("subject\n"), false);
});

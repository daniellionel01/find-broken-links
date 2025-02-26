#!/usr/bin/env bun

import { extractURLs } from "./index.ts";

const testText = `
# Angle bracket links
See <https://en.wikipedia.org/wiki/Pointer_(computer_programming)> for pointers info.
Check <https://example.com> for reference.
`;

const urls = extractURLs(testText);
console.log("Extracted URLs:", urls);

// Inspect the regex directly
const angleBracketLinkRegex = /<(https?:\/\/[^>]+)>/g;
let match;
console.log("\nRegex matches:");
while ((match = angleBracketLinkRegex.exec(testText)) !== null) {
  console.log("Full match:", match[0]);
  console.log("Captured group:", match[1]);
}
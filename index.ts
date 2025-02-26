#!/usr/bin/env bun

import { resolve, join, relative } from "path";
import { existsSync, statSync, readdirSync } from "fs";

type LinkCheckResult = {
  file: string;
  link: string;
  status: "ok" | "broken" | "pending";
  statusCode?: number;
  error?: string;
};

const FILE_EXTENSIONS = [".md", ".markdown"];
const CONCURRENCY_LIMIT = 10;
const LINK_BATCH_SIZE = 5;

if (import.meta.main) {
  const args = Bun.argv.slice(2);
  if (args.length === 0) {
    console.error("Please provide a directory path to scan");
    process.exit(1);
  }

  const directoryPath = resolve(args[0]);

  if (!existsSync(directoryPath)) {
    console.error(`Directory does not exist: ${directoryPath}`);
    process.exit(1);
  }

  if (!statSync(directoryPath).isDirectory()) {
    console.error(`Not a directory: ${directoryPath}`);
    process.exit(1);
  }

  console.log(`Scanning for markdown files in: ${directoryPath}`);

  // Find all markdown files in the directory (recursive)
  const markdownFiles = findMarkdownFiles(directoryPath);
  console.log(`Found ${markdownFiles.length} markdown files`);

  // Process files in batches
  const results: LinkCheckResult[] = [];
  const allFiles = [...markdownFiles];

  while (allFiles.length > 0) {
    const batch = allFiles.splice(0, CONCURRENCY_LIMIT);

    const batchResults = await Promise.all(
      batch.map((filePath) => processFile(filePath, directoryPath)),
    );

    results.push(...batchResults.flat());
  }

  printResults(results);
}

async function processFile(
  filePath: string,
  directoryPath: string,
): Promise<LinkCheckResult[]> {
  const relativeFilePath = relative(directoryPath, filePath);
  console.log(`Processing: ${relativeFilePath}`);

  const results: LinkCheckResult[] = [];
  const fileContent = await Bun.file(filePath).text();

  const urlLinks = extractURLs(fileContent);

  const urlResults = await processUrlsInBatches(urlLinks, relativeFilePath);
  results.push(...urlResults);

  const relativeLinks = extractRelativeLinks(fileContent);
  for (const link of relativeLinks) {
    const baseDir = filePath.substring(0, filePath.lastIndexOf("/"));
    const targetPath = resolve(baseDir, link);

    results.push({
      file: relativeFilePath,
      link,
      status: existsSync(targetPath) ? "ok" : "broken",
    });
  }

  return results;
}

async function processUrlsInBatches(
  urls: string[],
  relativeFilePath: string,
): Promise<LinkCheckResult[]> {
  const results: LinkCheckResult[] = [];

  for (let i = 0; i < urls.length; i += LINK_BATCH_SIZE) {
    const batch = urls.slice(i, i + LINK_BATCH_SIZE);

    const batchPromises = batch.map(async (url) => {
      if (isLocalhostURL(url)) {
        return {
          file: relativeFilePath,
          link: url,
          status: "ok" as const,
          statusCode: 0,
          error: "Skipped localhost URL",
        };
      }

      try {
        const result = await checkURL(url);
        const isBroken = !result.ok || result.brokenGitHubLink;

        return {
          file: relativeFilePath,
          link: url,
          status: isBroken ? ("broken" as const) : ("ok" as const),
          statusCode: result.status,
          error: result.brokenGitHubLink
            ? "GitHub 404 (page shows not found)"
            : undefined,
        };
      } catch (error) {
        return {
          file: relativeFilePath,
          link: url,
          status: "broken" as const,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

function findMarkdownFiles(dirPath: string): string[] {
  const files: string[] = [];

  function scanDirectory(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        scanDirectory(entryPath);
      } else if (
        entry.isFile() &&
        FILE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))
      ) {
        files.push(entryPath);
      }
    }
  }

  scanDirectory(dirPath);
  return files;
}

function isLocalhostURL(url: string): boolean {
  return (
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.match(/https?:\/\/[^\/]+:\d+/) !== null
  );
}

export function extractURLs(content: string): string[] {
  const urls: string[] = [];
  
  // More sophisticated regex that handles parentheses in URLs
  // This looks for markdown links: [text](url)
  // But handles potential nested parentheses in the URL itself
  const regex = /\[([^\]]+)\]\(((?:\([^)]*\)|[^()])*(?:\([^)]*\)|[^()])+)\)/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const linkText = match[1];
    let linkUrl = match[2].trim();
    
    // Only include http/https URLs
    if (linkUrl.startsWith('http')) {
      urls.push(linkUrl);
    }
  }
  
  return urls;
}

export function extractRelativeLinks(content: string): string[] {
  const links: string[] = [];

  // Using the same improved regex that handles parentheses
  const regex = /\[([^\]]+)\]\(((?:\([^)]*\)|[^()])*(?:\([^)]*\)|[^()])+)\)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const linkText = match[1];
    const linkUrl = match[2].trim();

    // Only include relative links that don't start with http/https or /
    if (!linkUrl.startsWith("http") && !linkUrl.startsWith("/")) {
      // Remove hash fragments and query parameters
      const cleanLink = linkUrl.split("#")[0].split("?")[0];

      // Skip code snippets, arguments, etc.
      if (isLikelyAFilePath(cleanLink)) {
        links.push(cleanLink);
      }
    }
  }

  return links;
}

export function fixParenthesesInUrl(url: string): string | null {
  if (!url.includes("(") && !url.includes(")")) {
    return url;
  }

  let openCount = 0;
  let closeCount = 0;

  for (const char of url) {
    if (char === "(") openCount++;
    if (char === ")") closeCount++;
  }

  if (openCount === closeCount) {
    return url;
  }

  if (url.includes("github.com") && url.includes("/blob/")) {
    const githubMatch = url.match(
      /^(https?:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[^/]+\/[^#)]+)(?:#L\d+(?:-L\d+)?)?(.*)?$/,
    );
    if (githubMatch) {
      return githubMatch[1] + (githubMatch[2] || "");
    }
  }

  if (url.includes("wikipedia.org")) {
    const wikiMatch = url.match(
      /^(https?:\/\/[^/]+\.wikipedia\.org\/wiki\/[^)]+)$/,
    );
    if (wikiMatch) {
      return wikiMatch[1];
    }
  }

  return url;
}

export function isLikelyAFilePath(str: string): boolean {
  const commonFileExtensions = [
    ".md",
    ".markdown",
    ".txt",
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".html",
    ".css",
    ".json",
    ".yml",
    ".yaml",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".pdf",
    ".doc",
    ".docx",
  ];

  if (commonFileExtensions.some((ext) => str.endsWith(ext))) {
    return true;
  }

  // Check if it looks like a path (contains / or \ but not too many spaces)
  if ((str.includes("/") || str.includes("\\")) && str.split(" ").length <= 2) {
    return true;
  }

  // Skip if it looks like a code snippet or command args
  if (
    str.includes(" ") &&
    (str.includes(",") ||
      str.includes(":") ||
      str.includes("{") ||
      str.includes("}") ||
      str.includes("`") ||
      str.match(/^\d+$/)) // Just a number
  ) {
    return false;
  }

  // Skip typical code symbols
  if (
    str === "=" ||
    str === "->" ||
    str === "=>" ||
    str.match(/^\d+$/) ||
    str === "{" ||
    str === "}" ||
    str === "()" ||
    str === "[]"
  ) {
    return false;
  }

  // Skip strings with too many spaces (likely sentences, not file paths)
  if (str.split(" ").length > 3) {
    return false;
  }

  // Default to treating it as a path if nothing else matched
  return true;
}

async function checkURL(
  url: string,
): Promise<Response & { brokenGitHubLink?: boolean }> {
  // First, check if this is a GitHub link
  const isGitHubLink =
    url.includes("github.com") &&
    (url.includes("/blob/") || url.includes("/tree/"));

  try {
    // For GitHub links, we need the content to check for "404" indicators
    if (isGitHubLink) {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
      });

      // If it's a GitHub link, check the response text for indicators of missing content
      if (response.ok) {
        const text = await response.text();

        // GitHub shows specific text when a file doesn't exist or path is invalid
        const isNotFound =
          text.includes("404: Not Found") ||
          text.includes("This file does not appear to exist") ||
          text.includes("Page not found");

        // Add a custom property to the response
        const enhancedResponse = response as Response & {
          brokenGitHubLink?: boolean;
        };
        enhancedResponse.brokenGitHubLink = isNotFound;

        return enhancedResponse;
      }

      return response;
    }

    // Non-GitHub links - try HEAD first
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
    });
    return response;
  } catch (error) {
    // Retry with GET if HEAD is not supported
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
      });
      return response;
    } catch (error) {
      throw error;
    }
  }
}

function printResults(results: LinkCheckResult[]): void {
  // Count broken links
  const brokenLinks = results.filter((r) => r.status === "broken");
  const skippedLinks = results.filter(
    (r) => r.error === "Skipped localhost URL",
  );

  console.log("\n====== RESULTS ======");
  console.log(`Total links checked: ${results.length}`);
  console.log(`Broken links found: ${brokenLinks.length}`);
  console.log(`Localhost links skipped: ${skippedLinks.length}`);

  if (brokenLinks.length > 0) {
    console.log("\nBroken Links:");

    const byFile: Record<string, LinkCheckResult[]> = {};

    for (const result of brokenLinks) {
      if (!byFile[result.file]) {
        byFile[result.file] = [];
      }
      byFile[result.file].push(result);
    }

    for (const [file, links] of Object.entries(byFile)) {
      console.log(`\nFile: ${file}`);

      for (const link of links) {
        if (link.statusCode) {
          console.log(`  - ${link.link} (Status: ${link.statusCode})`);
        } else if (link.error) {
          console.log(`  - ${link.link} (Error: ${link.error})`);
        } else {
          console.log(`  - ${link.link} (Not found)`);
        }
      }
    }
  }

  console.log("\nDone!");
}

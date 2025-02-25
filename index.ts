#!/usr/bin/env bun

import { resolve, join, relative } from "path";
import { existsSync, statSync, readdirSync } from "fs";

// Types
type LinkCheckResult = {
  file: string;
  link: string;
  status: "ok" | "broken" | "pending";
  statusCode?: number;
  error?: string;
};

// Constants
const URL_REGEX = /\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
const RELATIVE_LINK_REGEX = /\[.*?\]\((?!https?:\/\/)([^\s)]+)\)/g;
const FILE_EXTENSIONS = [".md", ".markdown"];

// Main function
async function main() {
  // Get the directory path from command line arguments
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

  // Process each file and check for broken links
  const results: LinkCheckResult[] = [];

  for (const filePath of markdownFiles) {
    const relativeFilePath = relative(directoryPath, filePath);
    console.log(`Processing: ${relativeFilePath}`);

    const fileContent = await Bun.file(filePath).text();
    const links = extractLinks(fileContent);

    // Check URL links
    const urlLinks = extractURLs(fileContent);
    for (const url of urlLinks) {
      try {
        const result = await checkURL(url);
        results.push({
          file: relativeFilePath,
          link: url,
          status: result.ok ? "ok" : "broken",
          statusCode: result.status,
        });
      } catch (error) {
        results.push({
          file: relativeFilePath,
          link: url,
          status: "broken",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Check relative links
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
  }

  // Print results
  printResults(results);
}

// Helper functions
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

function extractLinks(content: string): string[] {
  const urlLinks = extractURLs(content);
  const relativeLinks = extractRelativeLinks(content);
  return [...urlLinks, ...relativeLinks];
}

function extractURLs(content: string): string[] {
  const urls: string[] = [];
  let match;

  while ((match = URL_REGEX.exec(content)) !== null) {
    urls.push(match[1]);
  }

  return urls;
}

function extractRelativeLinks(content: string): string[] {
  const links: string[] = [];
  let match;

  while ((match = RELATIVE_LINK_REGEX.exec(content)) !== null) {
    // Remove any hash fragments or query parameters
    const link = match[1].split("#")[0].split("?")[0];
    if (link) {
      links.push(link);
    }
  }

  return links;
}

async function checkURL(url: string): Promise<Response> {
  try {
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

  console.log("\n====== RESULTS ======");
  console.log(`Total links checked: ${results.length}`);
  console.log(`Broken links found: ${brokenLinks.length}`);

  if (brokenLinks.length > 0) {
    console.log("\nBroken Links:");

    // Group by file
    const byFile: Record<string, LinkCheckResult[]> = {};

    for (const result of brokenLinks) {
      if (!byFile[result.file]) {
        byFile[result.file] = [];
      }
      byFile[result.file].push(result);
    }

    // Print broken links grouped by file
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

// Run the main function
main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

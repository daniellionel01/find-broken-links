import { test, expect, describe } from "bun:test";
import { extractURLs } from "../index.ts";

describe("Complex link extraction tests", () => {
  test("should handle multiple Wikipedia articles with parentheses", () => {
    const markdown = `
# Wikipedia Articles with Parentheses

- [Lisp (programming language)](https://en.wikipedia.org/wiki/Lisp_(programming_language))
- [Bracket (mathematics)](https://en.wikipedia.org/wiki/Bracket_(mathematics))
- [Set (mathematics)](https://en.wikipedia.org/wiki/Set_(mathematics))
- [C (programming language)](https://en.wikipedia.org/wiki/C_(programming_language))
- [C++ (programming language)](https://en.wikipedia.org/wiki/C%2B%2B_(programming_language))
- [Scheme (programming language)](https://en.wikipedia.org/wiki/Scheme_(programming_language))
    `;

    const urls = extractURLs(markdown);
    expect(urls).toEqual([
      "https://en.wikipedia.org/wiki/Lisp_(programming_language)",
      "https://en.wikipedia.org/wiki/Bracket_(mathematics)",
      "https://en.wikipedia.org/wiki/Set_(mathematics)",
      "https://en.wikipedia.org/wiki/C_(programming_language)",
      "https://en.wikipedia.org/wiki/C%2B%2B_(programming_language)",
      "https://en.wikipedia.org/wiki/Scheme_(programming_language)",
    ]);
  });

  test("should handle GitHub URLs with complex paths", () => {
    const markdown = `
# GitHub URLs with Complex Paths

- [Example file with parentheses](https://github.com/user/repo/blob/main/docs/example(v1).md)
- [File with line numbers](https://github.com/user/repo/blob/main/src/main.js#L10-L20)
- [Special characters in filename](https://github.com/user/repo/blob/main/docs/special_chars+&$%.md)
- [Nested directory structure](https://github.com/user/repo/blob/main/src/components/ui/Button.tsx)
    `;

    const urls = extractURLs(markdown);
    expect(urls).toEqual([
      "https://github.com/user/repo/blob/main/docs/example(v1).md",
      "https://github.com/user/repo/blob/main/src/main.js#L10-L20",
      "https://github.com/user/repo/blob/main/docs/special_chars+&$%.md",
      "https://github.com/user/repo/blob/main/src/components/ui/Button.tsx",
    ]);
  });

  test("should handle URLs with query parameters and hash fragments", () => {
    const markdown = `
# URLs with Query Parameters and Hash Fragments

- [Search results](https://example.com/search?q=test&sort=asc#results)
- [API Documentation](https://api.example.com/v1/docs#authentication)
- [Complex query](https://example.com/search?q=hello%20world&category=tech&limit=25#page-2)
- [Fragment only](https://example.com/page#section-3)
    `;

    const urls = extractURLs(markdown);
    expect(urls).toEqual([
      "https://example.com/search?q=test&sort=asc#results",
      "https://api.example.com/v1/docs#authentication",
      "https://example.com/search?q=hello%20world&category=tech&limit=25#page-2",
      "https://example.com/page#section-3",
    ]);
  });

  test("should handle URLs with escaped characters and unusual formats", () => {
    const markdown = `
# URLs with Escaped Characters and Unusual Formats

- [Spaces in URL](https://example.com/path%20with%20spaces)
- [URL with quotes](https://example.com/?name=%22quoted%22)
- [URL with special chars](https://example.com/path?symbols=%23%24%25%5E&other=%2A%40)
- [URL with plus signs](https://example.com/search?q=C%2B%2B+programming)
    `;

    const urls = extractURLs(markdown);
    expect(urls).toEqual([
      "https://example.com/path%20with%20spaces",
      "https://example.com/?name=%22quoted%22",
      "https://example.com/path?symbols=%23%24%25%5E&other=%2A%40",
      "https://example.com/search?q=C%2B%2B+programming",
    ]);
  });

  test("should handle URLs in real-world context", () => {
    const markdown = `
# Real-world Documentation Example

## Installation
To install the package, follow the [installation guide](https://example.com/docs/installation).

## API Reference
Check out the [API documentation](https://api.example.com/v2/reference#endpoints) for detailed information.

## Examples
See [this example](https://github.com/user/repo/blob/main/examples/demo.js) to get started.

## Related Projects
- [Project A](https://github.com/user/project-a)
- [Project B (legacy)](https://github.com/user/project-b-legacy)
- [Documentation Tool](https://example.com/tool?version=2.0#features)

## Further Reading
Learn more about the topic in [Wikipedia's article on API design](https://en.wikipedia.org/wiki/API_design_(principles)).
    `;

    const urls = extractURLs(markdown);
    expect(urls).toEqual([
      "https://example.com/docs/installation",
      "https://api.example.com/v2/reference#endpoints",
      "https://github.com/user/repo/blob/main/examples/demo.js",
      "https://github.com/user/project-a",
      "https://github.com/user/project-b-legacy",
      "https://example.com/tool?version=2.0#features",
      "https://en.wikipedia.org/wiki/API_design_(principles)",
    ]);
  });
});

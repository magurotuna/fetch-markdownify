import { assertEquals } from "@std/assert";
import { convertToMarkdown } from "./markdown.ts";

Deno.test("convertToMarkdown - plain text", () => {
  const text = "Hello, world!\nThis is plain text.";
  const result = convertToMarkdown(text, "text");
  assertEquals(result, text);
});

Deno.test("convertToMarkdown - simple HTML", () => {
  const html = "<h1>Hello</h1><p>This is a <strong>test</strong>.</p>";
  const result = convertToMarkdown(html, "html");
  assertEquals(result.trim(), "# Hello\n\nThis is a **test**.");
});

Deno.test("convertToMarkdown - HTML with links", () => {
  const html = '<p>Visit <a href="https://example.com">our website</a></p>';
  const result = convertToMarkdown(html, "html");
  assertEquals(result.trim(), "Visit [our website](https://example.com)");
});

Deno.test("convertToMarkdown - HTML with code blocks", () => {
  const html =
    '<pre><code class="language-js">console.log("hello");</code></pre>';
  const result = convertToMarkdown(html, "html");
  assertEquals(result.trim(), '```js\nconsole.log("hello");\n```');
});

Deno.test("convertToMarkdown - HTML with lists", () => {
  const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
  const result = convertToMarkdown(html, "html");
  // Turndown uses * with spaces for bullet lists
  assertEquals(result.trim(), "*   Item 1\n*   Item 2");
});

Deno.test("convertToMarkdown - malformed HTML", () => {
  const html = "<p>Unclosed paragraph";
  const result = convertToMarkdown(html, "html");
  // Should handle gracefully
  assertEquals(typeof result, "string");
  assertEquals(result.includes("Unclosed paragraph"), true);
});

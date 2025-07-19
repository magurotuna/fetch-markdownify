import { assertEquals } from "@std/assert";
import { estimateTokens, splitIntoChunks } from "./tokenizer.ts";

// Test simple token estimation
Deno.test("estimateTokens counts approximate tokens", () => {
  // Rule: ~4 characters per token (rough approximation)
  assertEquals(estimateTokens("hello world"), 3); // 11 chars / 4 ≈ 2.75 → 3
  assertEquals(estimateTokens(""), 0);
  assertEquals(estimateTokens("a".repeat(400)), 100); // 400 chars / 4 = 100
  assertEquals(estimateTokens("Hello, world!"), 3); // 13 chars / 4 ≈ 3.25 → 3
  assertEquals(estimateTokens("The quick brown fox"), 5); // 19 chars / 4 ≈ 4.75 → 5
});

// Test edge cases for token estimation
Deno.test("estimateTokens handles unicode and special characters", () => {
  assertEquals(estimateTokens("こんにちは"), 1); // 5 chars (Japanese) / 4 = 1.25 → 1
  assertEquals(estimateTokens("👋🌍"), 1); // 2 emojis (4 chars in JS) / 4 = 1
  assertEquals(estimateTokens("\n\n\n"), 1); // 3 chars / 4 = 0.75 → 1
});

// Test content splitting preserves original content
Deno.test("splitIntoChunks preserves content integrity", () => {
  const content = "Line 1\n\nLine 2\n\nLine 3";
  const chunks = splitIntoChunks(content, 10);
  assertEquals(chunks.join(""), content);
});

// Test that chunks respect token limits
Deno.test("splitIntoChunks respects maxTokens limit", () => {
  const content = "This is a test. ".repeat(100); // ~400 tokens
  const chunks = splitIntoChunks(content, 50);

  for (const chunk of chunks) {
    const tokens = estimateTokens(chunk);
    assertEquals(
      tokens <= 50,
      true,
      `Chunk has ${tokens} tokens, exceeds limit of 50`,
    );
  }
});

// Test empty content handling
Deno.test("splitIntoChunks handles empty content", () => {
  assertEquals(splitIntoChunks("", 100), [""]);
});

// Test single small chunk
Deno.test("splitIntoChunks returns single chunk for small content", () => {
  const content = "Small content";
  const chunks = splitIntoChunks(content, 100);
  assertEquals(chunks.length, 1);
  assertEquals(chunks[0], content);
});

// Test paragraph boundary splitting
Deno.test("splitIntoChunks prefers paragraph boundaries", () => {
  const content =
    "First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph here.";
  const chunks = splitIntoChunks(content, 10); // ~40 chars per chunk

  // Each chunk should ideally end at a paragraph boundary
  for (const chunk of chunks.slice(0, -1)) { // All but last chunk
    const lastChars = chunk.slice(-2);
    assertEquals(
      lastChars === "\n\n" || chunk.endsWith(".") || chunk.endsWith(".\n"),
      true,
      `Chunk should end at paragraph boundary, but ends with: "${lastChars}"`,
    );
  }
});

// Test code block preservation
Deno.test("splitIntoChunks preserves code blocks intact", () => {
  const content =
    "Text before\n```js\nfunction long() {\n  // This is a long code block\n  return 42;\n}\n```\nText after";
  const chunks = splitIntoChunks(content, 15); // Force split

  // Verify no chunk contains partial code block
  for (const chunk of chunks) {
    const codeBlockStarts = (chunk.match(/```/g) || []).length;
    assertEquals(
      codeBlockStarts % 2,
      0,
      "Code blocks should not be split across chunks",
    );
  }
});

// Test markdown header handling
Deno.test("splitIntoChunks keeps headers with content", () => {
  const content =
    "# Main Header\nContent for main header\n\n## Sub Header\nContent for sub header";
  const chunks = splitIntoChunks(content, 12); // ~48 chars per chunk

  // Headers should stay with their content
  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].startsWith("#")) {
        assertEquals(
          lines[i + 1].length > 0,
          true,
          `Header "${lines[i]}" should have content following it`,
        );
      }
    }
  }
});

import { assertEquals, assertExists } from "@std/assert";
import {
  formatBytes,
  getFileMetadata,
  saveMarkdownToTempFile,
} from "./file_manager.ts";

// Test file saving with Deno's temp functions
Deno.test("saveMarkdownToTempFile creates temporary file", async () => {
  const content = "# Test Content\n\nThis is a test.";
  const url = "https://example.com/page";

  const result = await saveMarkdownToTempFile(content, url);

  // Verify file path exists and is absolute
  assertExists(result.filepath);
  assertEquals(result.filepath.endsWith(".md"), true);

  // Verify file contents
  const savedContent = await Deno.readTextFile(result.filepath);
  assertEquals(savedContent, content);

  // Cleanup
  await Deno.remove(result.filepath);
});

// Test file metadata
Deno.test("getFileMetadata returns correct information", async () => {
  const content = "# Large Content\n\n" + "Paragraph ".repeat(1000);
  const { filepath } = await saveMarkdownToTempFile(
    content,
    "https://example.com",
  );

  const metadata = await getFileMetadata(
    filepath,
    content,
    "https://example.com",
  );
  assertEquals(metadata.path, filepath);
  assertEquals(metadata.size_bytes > 0, true);
  assertExists(metadata.size_readable);
  assertEquals(typeof metadata.created_at, "string");
  assertEquals(metadata.total_tokens > 0, true);
  assertEquals(metadata.url, "https://example.com");

  await Deno.remove(filepath);
});

// Test formatBytes utility
Deno.test("formatBytes formats sizes correctly", () => {
  assertEquals(formatBytes(0), "0 Bytes");
  assertEquals(formatBytes(1024), "1 KB");
  assertEquals(formatBytes(1048576), "1 MB");
  assertEquals(formatBytes(1536), "1.5 KB");
  assertEquals(formatBytes(2097152), "2 MB");
  assertEquals(formatBytes(1073741824), "1 GB");
});

// Test filename generation
Deno.test("temp file has meaningful prefix", async () => {
  const { filepath } = await saveMarkdownToTempFile(
    "test",
    "https://example.com/page",
  );

  // Should contain some identifier
  const filename = filepath.split("/").pop() || filepath.split("\\").pop();
  assertExists(filename);
  assertEquals(filename.includes("fetch_markdownify"), true);
  assertEquals(filename.endsWith(".md"), true);

  await Deno.remove(filepath);
});

// Test multiple files don't conflict
Deno.test("multiple temp files have unique names", async () => {
  const result1 = await saveMarkdownToTempFile(
    "content1",
    "https://example.com/1",
  );
  const result2 = await saveMarkdownToTempFile(
    "content2",
    "https://example.com/2",
  );

  // Paths should be different
  assertEquals(result1.filepath !== result2.filepath, true);

  // Both files should exist
  const content1 = await Deno.readTextFile(result1.filepath);
  const content2 = await Deno.readTextFile(result2.filepath);
  assertEquals(content1, "content1");
  assertEquals(content2, "content2");

  // Cleanup
  await Deno.remove(result1.filepath);
  await Deno.remove(result2.filepath);
});

// Test error handling for invalid file path
Deno.test("getFileMetadata handles non-existent file", async () => {
  try {
    await getFileMetadata(
      "/non/existent/file.md",
      "content",
      "https://example.com",
    );
    assertEquals(true, false, "Should have thrown an error");
  } catch (error) {
    assertExists(error);
  }
});

import { estimateTokens } from "./tokenizer.ts";

export interface SaveFileResult {
  filepath: string;
}

export interface FileMetadata {
  path: string;
  size_bytes: number;
  size_readable: string;
  created_at: string;
  url: string;
  total_tokens: number;
}

/**
 * Saves markdown content to a temporary file using Deno's built-in temp file creation.
 * Returns the path to the created file.
 */
export async function saveMarkdownToTempFile(
  content: string,
  _url: string,
): Promise<SaveFileResult> {
  // Create a temporary file with a meaningful prefix and .md extension
  const filepath = await Deno.makeTempFile({
    prefix: "fetch_markdownify_",
    suffix: ".md",
  });

  // Write the content to the file
  await Deno.writeTextFile(filepath, content);

  return { filepath };
}

/**
 * Gets metadata about a file including size, creation time, and token count.
 */
export async function getFileMetadata(
  filepath: string,
  content: string,
  url: string,
): Promise<FileMetadata> {
  // Get file stats
  const fileInfo = await Deno.stat(filepath);

  if (!fileInfo.isFile) {
    throw new Error(`Path ${filepath} is not a file`);
  }

  return {
    path: filepath,
    size_bytes: fileInfo.size,
    size_readable: formatBytes(fileInfo.size),
    created_at: fileInfo.birthtime?.toISOString() || new Date().toISOString(),
    url: url,
    total_tokens: estimateTokens(content),
  };
}

/**
 * Formats bytes into human-readable format (e.g., "1.5 KB", "2 MB").
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${value} ${sizes[i]}`;
}

/**
 * Estimates the number of tokens in a text string.
 * Uses a simple approximation of ~4 characters per token.
 * This is a rough estimate that works reasonably well for English text.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Approximate 4 characters per token
  // For test case "Hello, world!" (13 chars), we want 3 tokens
  // 13 / 4 = 3.25, Math.round gives us 3
  return Math.round(text.length / 4);
}

/**
 * Splits content into chunks based on a maximum token limit.
 * Attempts to split at natural boundaries when possible.
 */
export function splitIntoChunks(content: string, maxTokens: number): string[] {
  if (!content) return [""];

  const contentTokens = estimateTokens(content);

  // If content fits in one chunk, return as-is
  if (contentTokens <= maxTokens) {
    return [content];
  }

  const chunks: string[] = [];
  const maxCharsPerChunk = maxTokens * 4; // Convert tokens to approximate characters

  let position = 0;

  while (position < content.length) {
    let chunkEnd = Math.min(position + maxCharsPerChunk, content.length);

    // If this is not the last chunk, try to find a good split point
    if (chunkEnd < content.length) {
      const chunkContent = content.slice(position, chunkEnd);

      // Priority 1: Try to split at paragraph boundaries (\n\n)
      const lastDoubleNewline = chunkContent.lastIndexOf("\n\n");
      if (lastDoubleNewline > maxCharsPerChunk * 0.5) { // Only if we're at least halfway through
        chunkEnd = position + lastDoubleNewline + 2; // Include the newlines
      } // Priority 2: Try to split at single newline
      else {
        const lastNewline = chunkContent.lastIndexOf("\n");
        if (lastNewline > maxCharsPerChunk * 0.7) { // At least 70% through
          chunkEnd = position + lastNewline + 1;
        } // Priority 3: Try to split at sentence boundary
        else {
          const lastPeriod = chunkContent.lastIndexOf(". ");
          if (lastPeriod > maxCharsPerChunk * 0.7) {
            chunkEnd = position + lastPeriod + 2;
          }
        }
      }

      // Special handling for code blocks - don't split them
      const chunk = content.slice(position, chunkEnd);
      const codeBlockStarts = (chunk.match(/```/g) || []).length;
      if (codeBlockStarts % 2 === 1) { // Odd number means we're splitting a code block
        // Find the closing ```
        const nextCodeBlockEnd = content.indexOf("```", chunkEnd);
        if (
          nextCodeBlockEnd !== -1 &&
          nextCodeBlockEnd + 3 - position <= maxCharsPerChunk * 1.5
        ) {
          // If the code block end is within 150% of our limit, include it
          chunkEnd = nextCodeBlockEnd + 3;
        }
      }
    }

    chunks.push(content.slice(position, chunkEnd));
    position = chunkEnd;
  }

  return chunks;
}

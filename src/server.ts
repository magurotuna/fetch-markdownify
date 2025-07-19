import { Server } from "npm:@modelcontextprotocol/sdk@1.15.0/server/index.js";
import { StdioServerTransport } from "npm:@modelcontextprotocol/sdk@1.15.0/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "npm:@modelcontextprotocol/sdk@1.15.0/types.js";
import { z } from "npm:zod@3.23.8";
import { convertToMarkdown } from "./markdown.ts";
import { estimateTokens, splitIntoChunks } from "./tokenizer.ts";
import { getFileMetadata, saveMarkdownToTempFile } from "./file_manager.ts";

const FetchUrlSchema = z.object({
  url: z.string().url().describe("The URL to fetch and convert to markdown"),
  limit: z
    .number()
    .optional()
    .describe("The maximum number of characters to return"),
  chunk_size: z
    .number()
    .optional()
    .describe("Maximum tokens per chunk (default: 20000)"),
  chunk_index: z
    .number()
    .optional()
    .describe("Which chunk to retrieve (0-based, default: 0)"),
  metadata_only: z
    .boolean()
    .optional()
    .describe("Return only metadata about chunks (default: false)"),
  save_to_file: z
    .boolean()
    .optional()
    .describe(
      "Save content to temporary file instead of returning it (default: false)",
    ),
});

export interface ServerOptions {
  fetchFn?: typeof fetch;
}

// Create a new server instance for each test to avoid connection conflicts
export function createServer(options: ServerOptions = {}): Server {
  const { fetchFn = fetch } = options;

  const server = new Server(
    {
      name: "fetch-markdownify",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => {
    return {
      tools: [
        {
          name: "fetch-url",
          description: "Fetches content from a URL and converts it to markdown",
          inputSchema: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "The URL to fetch and convert to markdown",
              },
              limit: {
                type: "number",
                description: "The maximum number of characters to return",
              },
              chunk_size: {
                type: "number",
                description: "Maximum tokens per chunk (default: 20000)",
              },
              chunk_index: {
                type: "number",
                description: "Which chunk to retrieve (0-based, default: 0)",
              },
              metadata_only: {
                type: "boolean",
                description:
                  "Return only metadata about chunks (default: false)",
              },
              save_to_file: {
                type: "boolean",
                description:
                  "Save content to temporary file instead of returning it (default: false)",
              },
            },
            required: ["url"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "fetch-url") {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    try {
      const args = FetchUrlSchema.parse(request.params.arguments);

      // Fetch the URL
      const response = await fetchFn(args.url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();

      // Convert to markdown based on content type
      let markdown: string;
      if (contentType.includes("text/html")) {
        markdown = convertToMarkdown(text, "html");
      } else if (
        contentType.includes("text/plain") || contentType.includes("text/")
      ) {
        markdown = convertToMarkdown(text, "text");
      } else {
        // For other content types, wrap in code block
        markdown = `\`\`\`\n${text}\n\`\`\``;
      }

      // Apply character limit if specified (backward compatibility)
      if (args.limit && markdown.length > args.limit) {
        markdown = markdown.slice(0, args.limit);
      }

      // Handle save_to_file option
      if (args.save_to_file) {
        const { filepath } = await saveMarkdownToTempFile(markdown, args.url);
        const metadata = await getFileMetadata(filepath, markdown, args.url);

        return {
          content: [{
            type: "text",
            text: JSON.stringify(
              {
                saved_to_file: true,
                file_path: filepath,
                file_metadata: metadata,
                message:
                  "Content saved successfully. Use file reading tools to access the content.",
              },
              null,
              2,
            ),
          }],
        };
      }

      // Handle chunking
      const chunkSize = args.chunk_size || 20000;
      const chunkIndex = args.chunk_index || 0;
      const metadataOnly = args.metadata_only || false;

      const totalTokens = estimateTokens(markdown);
      const chunks = splitIntoChunks(markdown, chunkSize);
      const totalChunks = chunks.length;

      // If metadata_only is true, return chunk information
      if (metadataOnly) {
        const metadata = {
          total_chunks: totalChunks,
          total_tokens: totalTokens,
          chunk_size: chunkSize,
          chunks: chunks.map((chunk, index) => ({
            index,
            tokens: estimateTokens(chunk),
            start_char: index === 0
              ? 0
              : chunks.slice(0, index).join("").length,
            end_char: chunks.slice(0, index + 1).join("").length,
          })),
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(metadata, null, 2),
            },
          ],
        };
      }

      // Return the requested chunk
      if (chunkIndex >= totalChunks) {
        throw new Error(
          `Chunk index ${chunkIndex} is out of range. Total chunks: ${totalChunks}`,
        );
      }

      const requestedChunk = chunks[chunkIndex];

      // Only add chunk navigation metadata if there are multiple chunks
      let finalText = requestedChunk;
      if (totalChunks > 1) {
        const chunkMetadata = `\n\n<!-- Chunk ${
          chunkIndex + 1
        }/${totalChunks} | Tokens: ~${
          estimateTokens(requestedChunk)
        } | Total tokens: ~${totalTokens} -->`;
        finalText = requestedChunk + chunkMetadata;
      }

      return {
        content: [
          {
            type: "text",
            text: finalText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching URL: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

// Default server instance for production use
export const server: Server = createServer();

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP server 'fetch-markdownify' running on stdio");
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Server error:", error);
    Deno.exit(1);
  });
}

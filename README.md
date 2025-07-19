# fetch-markdownify

[![JSR](https://jsr.io/badges/@magurotuna/fetch-markdownify)](https://jsr.io/@magurotuna/fetch-markdownify)

An MCP (Model Context Protocol) server that fetches content from URLs and
converts it to clean Markdown format.

## Features

- Fetches content from any URL
- Converts HTML to Markdown using
  [turndown](https://mixmark-io.github.io/turndown/)
- Handles various content types (HTML, plain text, etc.)
- Preserves code blocks and formatting
- **Pagination support** for large content (chunking)
- **File-saving option** for efficient handling of large documents
- Built with Deno for secure, permission-based execution

## Installation (Claude Code)

1. Ensure you have Deno installed:

```bash
curl -fsSL https://deno.land/install.sh | sh
```

2. Add to Claude Code

Use the `claude mcp add` command to set it up as an MCP server. The server
requires network and write permissions:

```bash
claude mcp add fetch-markdownify deno -- run --allow-net --allow-write jsr:@magurotuna/fetch-markdownify
```

**Permissions explained:**

- `--allow-net`: Required to fetch content from URLs
- `--allow-write`: Required for the file-saving feature (creates temporary
  files)

That's it!

### Using the Tool

Once integrated, you can use the `fetch-url` tool in Claude:

```
Use the fetch-url tool to get the content of https://example.com as markdown
```

## Tool Details

### fetch-url

Fetches content from a URL and converts it to Markdown.

**Input:**

- `url` (string, required): The URL to fetch and convert
- `limit` (number, optional): Maximum number of characters to return
- `chunk_size` (number, optional): Maximum tokens per chunk (default: 20000)
- `chunk_index` (number, optional): Which chunk to retrieve (0-based,
  default: 0)
- `metadata_only` (boolean, optional): Return only metadata about chunks
  (default: false)
- `save_to_file` (boolean, optional): Save content to temporary file instead of
  returning it (default: false)

**Output:**

- When `save_to_file` is false: Markdown-formatted content (optionally chunked)
- When `save_to_file` is true: File path and metadata

**Examples:**

Basic usage:

```json
{
  "name": "fetch-url",
  "arguments": {
    "url": "https://example.com"
  }
}
```

Using pagination for large content:

```json
{
  "name": "fetch-url",
  "arguments": {
    "url": "https://example.com/large-doc",
    "chunk_size": 10000,
    "chunk_index": 0
  }
}
```

Saving to file (recommended for very large content):

```json
{
  "name": "fetch-url",
  "arguments": {
    "url": "https://example.com/huge-doc",
    "save_to_file": true
  }
}
```

When `save_to_file` is true, the response looks like:

```json
{
  "saved_to_file": true,
  "file_path": "/tmp/fetch_markdownify_abc123.md",
  "file_metadata": {
    "path": "/tmp/fetch_markdownify_abc123.md",
    "size_bytes": 150000,
    "size_readable": "146.5 KB",
    "created_at": "2024-01-20T10:30:00.000Z",
    "url": "https://example.com/huge-doc",
    "total_tokens": 37500
  },
  "message": "Content saved successfully. Use file reading tools to access the content."
}
```

## Security

This server uses Deno's permission system to ensure secure operation. Required
permissions:

- **Network** (`--allow-net`): To fetch content from URLs
- **Write** (`--allow-write`): To create temporary files when using the
  `save_to_file` feature
  - Files are created using Deno's `makeTempFile()` which places them in the
    system's temporary directory
  - No access to other filesystem locations

## License

MIT

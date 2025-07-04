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
- Built with Deno, allowing it to run with a permission that's really needed

## Installation (Claude Code)

1. Ensure you have Deno installed:

```bash
curl -fsSL https://deno.land/install.sh | sh
```

2. Add to Claude Code

Just run `claude mcp add` command to set it up as an MCP server. Notice that the
only granted permission is `--allow-net`; this ensures no filesystem access, env
var access, or subprocess spawning can be performed.

```bash
claude mcp add fetch-markdownify deno -- run --allow-net jsr:@magurotuna/fetch-markdownify
```

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

**Output:**

- Markdown-formatted content of the fetched URL

**Example:**

```json
{
  "name": "fetch-url",
  "arguments": {
    "url": "https://example.com"
  }
}
```

## Security

This server requires network access to fetch URLs. Deno's permission system
ensures that the server only has access to:

- Network (`--allow-net`): To fetch URLs

## License

MIT

# fetch-markdownify

An MCP (Model Context Protocol) server that fetches content from URLs and
converts it to clean Markdown format.

## Features

- Fetches content from any URL
- Converts HTML to Markdown using Turndown
- Handles various content types (HTML, plain text, etc.)
- Preserves code blocks and formatting
- Built with Deno for secure, modern TypeScript runtime

## Installation

1. Ensure you have Deno installed:

```bash
curl -fsSL https://deno.land/install.sh | sh
```

2. Clone this repository:

```bash
git clone https://github.com/yourusername/fetch-markdownify.git
cd fetch-markdownify
```

## Usage

### Running the Server

Start the MCP server:

```bash
deno task start
```

For development with auto-reload:

```bash
deno task dev
```

### Integration with Claude Desktop

Add the following to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "fetch-markdownify": {
      "command": "deno",
      "args": [
        "run",
        "--allow-net",
        "/path/to/fetch-markdownify/src/server.ts"
      ]
    }
  }
}
```

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

## Development

### Testing

The server supports dependency injection for the fetch function, making it easy
to test:

```typescript
import { createServer } from "./src/server.ts";

const mockFetch = (_url: string | URL | Request) => {
  return Promise.resolve(new Response("Mocked response"));
};

const server = createServer({ fetchFn: mockFetch });
```

### Available Tasks

- `deno task start` - Run the server
- `deno task dev` - Run with file watching
- `deno task test` - Run tests
- `deno task fmt` - Format code
- `deno task lint` - Lint code

### Project Structure

```
fetch-markdownify/
├── src/
│   ├── server.ts         # Main MCP server implementation
│   └── markdown.ts       # Markdown conversion utilities
├── deno.json            # Deno configuration
├── README.md            # Documentation
└── .gitignore
```

## Security

This server requires network access to fetch URLs. Deno's permission system
ensures that the server only has access to:

- Network (`--allow-net`): To fetch URLs

## License

MIT

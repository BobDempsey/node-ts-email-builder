# Node.js TypeScript Email Builder

[![Test](https://github.com/BobDempsey/node-ts-email-builder/actions/workflows/test.yml/badge.svg)](https://github.com/BobDempsey/node-ts-email-builder/actions/workflows/test.yml)
[![Build](https://github.com/BobDempsey/node-ts-email-builder/actions/workflows/build.yml/badge.svg)](https://github.com/BobDempsey/node-ts-email-builder/actions/workflows/build.yml)
[![Biome Lint and Format](https://github.com/BobDempsey/node-ts-email-builder/actions/workflows/biome.yml/badge.svg)](https://github.com/BobDempsey/node-ts-email-builder/actions/workflows/biome.yml)
[![codecov](https://codecov.io/gh/BobDempsey/node-ts-email-builder/branch/main/graph/badge.svg)](https://codecov.io/gh/BobDempsey/node-ts-email-builder)

A TypeScript email builder library with Handlebars templates, automatic CSS inlining, and a live preview server with hot reload.

## Features

- **Handlebars Templating** - Create dynamic email templates with layouts and partials
- **CSS Inlining** - Automatic CSS inlining with Juice for maximum email client compatibility
- **Plain Text Generation** - Automatic HTML to plain text conversion
- **Live Preview Server** - Hot-reloading preview server for rapid template development
- **TypeScript** - Full TypeScript support with strict type checking
- **Built-in Helpers** - Date formatting, currency, conditionals, and more
- **Multiple Data Sources** - Support for JSON files, API endpoints, or custom sources
- **Configurable** - Extensive configuration options for all components

## Project Structure

```
node-ts-email-builder/
├── src/
│   ├── email-builder/
│   │   ├── templates/
│   │   │   ├── layouts/        # Email layouts (default.hbs)
│   │   │   ├── partials/       # Reusable partials (header, footer, button)
│   │   │   └── emails/         # Email templates
│   │   ├── data/               # Sample data for templates
│   │   ├── compiler.ts         # Handlebars compilation & CSS inlining
│   │   ├── preview-server.ts   # Live preview with hot reload
│   │   ├── watcher.ts          # File watcher for hot reload
│   │   └── index.ts            # EmailBuilder class
│   ├── lib/                    # Utility libraries
│   └── index.ts                # Library exports
├── tests/                      # Test suites
└── dist/                       # Compiled output
```

## Getting Started

### Prerequisites

- Node.js 20.0.0 or higher
- npm 10.0.0 or higher

### Installation

```bash
npm install
```

### Preview Server

Start the development preview server with hot reload:

```bash
npm run dev
```

This starts a local server at `http://localhost:3000` where you can preview and edit email templates. Changes to `.hbs` files are instantly reflected.

### Building

Compile TypeScript to JavaScript:

```bash
npm run build
```

## Usage

### Programmatic API

```typescript
import { EmailBuilder } from 'node-ts-email-builder'

const builder = new EmailBuilder({
  port: 3000,
  dataSource: { type: 'json' }
})

await builder.init()

// Compile an email template
const { html, text, subject } = await builder.compile('welcome', {
  name: 'John',
  email: 'john@example.com'
})

// List available templates
const templates = await builder.listTemplates()
```

### Creating Email Templates

Create `.hbs` files in the `src/email-builder/templates/emails/` directory:

```handlebars
<!-- subject: Welcome to Our Service! -->

<h1>Hello, {{name}}!</h1>

<p>Thank you for signing up.</p>

{{> button url=activationUrl text="Activate Account"}}

<p>Best regards,<br>The Team</p>
```

### Using Layouts

Templates automatically use the default layout. Layouts wrap your email content:

```handlebars
<!-- layouts/default.hbs -->
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
  </style>
</head>
<body>
  {{> header}}
  {{{body}}}
  {{> footer}}
</body>
</html>
```

### Creating Partials

Partials are reusable template fragments in `templates/partials/`:

```handlebars
<!-- partials/button.hbs -->
<a href="{{url}}" style="background: #007bff; color: white; padding: 12px 24px;">
  {{text}}
</a>
```

Use partials in templates: `{{> button url="https://example.com" text="Click Me"}}`

## Built-in Handlebars Helpers

| Helper | Usage | Description |
|--------|-------|-------------|
| `formatDate` | `{{formatDate date "long"}}` | Format dates (short, long, iso, time, datetime) |
| `formatCurrency` | `{{formatCurrency 99.99 "USD"}}` | Format currency values |
| `formatNumber` | `{{formatNumber 1234.5 2}}` | Format numbers with decimals |
| `ifEquals` | `{{#ifEquals a b}}...{{/ifEquals}}` | Equality conditional |
| `ifNotEquals` | `{{#ifNotEquals a b}}...{{/ifNotEquals}}` | Inequality conditional |
| `ifGt` / `ifLt` | `{{#ifGt a b}}...{{/ifGt}}` | Greater/less than conditionals |
| `uppercase` | `{{uppercase name}}` | Convert to uppercase |
| `lowercase` | `{{lowercase name}}` | Convert to lowercase |
| `capitalize` | `{{capitalize name}}` | Capitalize first letter |
| `truncate` | `{{truncate text 50 "..."}}` | Truncate text |
| `pluralize` | `{{pluralize count "item" "items"}}` | Pluralize words |
| `json` | `{{json object}}` | JSON stringify (debugging) |

### Custom Helpers

```typescript
builder.registerHelper('bold', (text: string) => `<strong>${text}</strong>`)
```

## Configuration

```typescript
const builder = new EmailBuilder({
  // Server settings
  port: 3000,
  host: 'localhost',

  // Template paths (optional - has sensible defaults)
  templatesDir: './templates',
  layoutsDir: './templates/layouts',
  partialsDir: './templates/partials',
  emailsDir: './templates/emails',

  // Default layout name
  defaultLayout: 'default',

  // Data source configuration
  dataSource: {
    type: 'json',  // 'json' | 'api' | 'database'
    api: {
      endpoint: 'https://api.example.com/data',
      headers: { 'Authorization': 'Bearer token' },
      timeout: 5000
    }
  },

  // Cache settings
  cache: {
    enabled: true,
    ttl: 60000
  },

  // Juice CSS inlining options
  juice: {
    preserveMediaQueries: true,
    preserveFontFaces: true,
    removeStyleTags: false
  }
})
```

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Code Quality

```bash
npm run lint          # Check for linting issues
npm run format        # Check formatting
npm run check         # Run both checks
npm run check:fix     # Fix all issues
```

## Dependencies

### Runtime

- **handlebars** - Template engine for email compilation
- **juice** - CSS inlining for email client compatibility
- **html-to-text** - HTML to plain text conversion
- **express** - Preview server
- **ws** - WebSocket for hot reload
- **chokidar** - File watching for hot reload
- **pino** - Logging
- **zod** - Schema validation

### Development

- **typescript** - TypeScript compiler
- **jest** - Testing framework
- **biome** - Linting and formatting
- **husky** - Git hooks

## License

MIT

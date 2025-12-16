/**
 * Preview Server - Express + WebSocket for live preview
 */

import express, { type Application, type Request, type Response } from "express"
import type http from "http"
import { WebSocket, WebSocketServer } from "ws"
import { logger } from "@/lib/logger"
import type EmailCompiler from "./compiler"
import type DataLoader from "./data-loader"
import type {
	CompileResult,
	Config,
	PreviewServerOptions,
	PreviewStartResult,
	TemplateData
} from "./types"
import type FileWatcher from "./watcher"

interface PreviewServerDependencies {
	config: Config
	compiler: EmailCompiler
	dataLoader: DataLoader
	watcher: FileWatcher
}

interface WebSocketMessage {
	type: "reload" | "error"
	message?: string
}

class PreviewServer {
	private config: Config
	private compiler: EmailCompiler
	private dataLoader: DataLoader
	private watcher: FileWatcher
	private app: Application
	private server: http.Server | null
	private wss: WebSocketServer | null
	private clients: Set<WebSocket>

	constructor({
		config,
		compiler,
		dataLoader,
		watcher
	}: PreviewServerDependencies) {
		this.config = config
		this.compiler = compiler
		this.dataLoader = dataLoader
		this.watcher = watcher

		this.app = express()
		this.server = null
		this.wss = null
		this.clients = new Set()
	}

	/**
	 * Start the preview server
	 */
	async start(options: PreviewServerOptions = {}): Promise<PreviewStartResult> {
		const port = options.port || this.config.port

		this._setupRoutes()
		this._setupWebSocket()
		this._setupWatcher()

		await this.compiler.init()

		return new Promise((resolve) => {
			this.server = this.app.listen(port, () => {
				const url = `http://${this.config.host}:${port}`
				logger.info({ url }, "Email Preview Server running")

				if (options.open !== false) {
					// Dynamic import for ESM-only 'open' package
					import("open").then(({ default: open }) => open(url))
				}

				resolve({ url, port })
			})

			// Attach WebSocket server to HTTP server
			this.wss = new WebSocketServer({ server: this.server })
			this.wss.on("connection", (ws: WebSocket) => {
				this.clients.add(ws)
				ws.on("close", () => this.clients.delete(ws))
			})
		})
	}

	/**
	 * Stop the server
	 */
	async stop(): Promise<void> {
		if (this.watcher) {
			await this.watcher.stop()
		}

		if (this.wss) {
			this.wss.close()
		}

		if (this.server) {
			return new Promise((resolve) => {
				this.server!.close(() => resolve())
			})
		}
	}

	/**
	 * Set up Express routes
	 */
	private _setupRoutes(): void {
		// Serve static files
		this.app.use(express.static(this.config.publicDir))
		this.app.use(express.json())

		// Template listing page (UI)
		this.app.get("/", async (_req: Request, res: Response) => {
			try {
				const templates = await this.compiler.listTemplates()
				res.send(this._renderIndexPage(templates))
			} catch (err) {
				res.status(500).send(`Error: ${(err as Error).message}`)
			}
		})

		// List available templates (API)
		this.app.get("/api/templates", async (_req: Request, res: Response) => {
			try {
				const templates = await this.compiler.listTemplates()
				res.json({ templates })
			} catch (err) {
				res.status(500).json({ error: (err as Error).message })
			}
		})

		// Preview a specific template
		this.app.get(
			"/preview/:templateName",
			async (req: Request, res: Response) => {
				try {
					const templateName = req.params.templateName as string
					const { raw } = req.query

					// Load data for template
					const data = await this.dataLoader.load(
						templateName,
						req.query as Record<string, string>
					)

					// Compile the template
					const result = await this.compiler.compile(templateName, data)

					if (raw === "true") {
						// Return raw HTML
						res.type("html").send(result.html)
					} else {
						// Wrap in preview frame with hot reload script
						res.send(this._renderPreviewPage(templateName, result))
					}
				} catch (err) {
					logger.error(
						{ error: err, template: req.params.templateName },
						"Error rendering template"
					)
					res.status(500).send(this._renderErrorPage(err as Error))
				}
			}
		)

		// Get plain text version
		this.app.get(
			"/preview/:templateName/text",
			async (req: Request, res: Response) => {
				try {
					const templateName = req.params.templateName as string
					const data = await this.dataLoader.load(
						templateName,
						req.query as Record<string, string>
					)
					const result = await this.compiler.compile(templateName, data)
					res.type("text/plain").send(result.text)
				} catch (err) {
					res
						.status(500)
						.type("text/plain")
						.send(`Error: ${(err as Error).message}`)
				}
			}
		)

		// Compile with custom data (POST)
		this.app.post(
			"/preview/:templateName",
			async (req: Request, res: Response) => {
				try {
					const templateName = req.params.templateName as string
					const customData = req.body as TemplateData

					// Merge custom data with default data
					const defaultData = await this.dataLoader.load(templateName)
					const mergedData = { ...defaultData, ...customData }

					const result = await this.compiler.compile(templateName, mergedData)
					res.json(result)
				} catch (err) {
					res.status(500).json({ error: (err as Error).message })
				}
			}
		)
	}

	/**
	 * Set up WebSocket for hot reload
	 */
	private _setupWebSocket(): void {
		// WebSocket setup is done in start() after server is created
	}

	/**
	 * Set up file watcher for hot reload
	 */
	private _setupWatcher(): void {
		this.watcher.on("change", async ({ needsFullReload }) => {
			logger.info("Template changed, reloading...")

			try {
				// Reload compiler if layouts/partials changed
				if (needsFullReload) {
					await this.compiler.reload()
				}

				// Clear data cache
				this.dataLoader.clearCache()

				// Notify all connected clients
				this._broadcast({ type: "reload" })
			} catch (err) {
				logger.error({ error: err }, "Error reloading")
				this._broadcast({ type: "error", message: (err as Error).message })
			}
		})

		this.watcher.on("error", (err: Error) => {
			logger.error({ error: err }, "Watcher error")
		})

		this.watcher.start()
	}

	/**
	 * Broadcast message to all WebSocket clients
	 */
	private _broadcast(message: WebSocketMessage): void {
		const data = JSON.stringify(message)
		for (const client of this.clients) {
			if (client.readyState === WebSocket.OPEN) {
				client.send(data)
			}
		}
	}

	/**
	 * Render the index/listing page
	 */
	private _renderIndexPage(templates: string[]): string {
		const templateList = templates.length
			? templates
					.map(
						(t) => `
          <li>
            <a href="/preview/${t}" class="template-link">${t}</a>
            <span class="template-actions">
              <a href="/preview/${t}?raw=true" target="_blank" title="Raw HTML">📄</a>
              <a href="/preview/${t}/text" target="_blank" title="Plain text">📝</a>
            </span>
          </li>
        `
					)
					.join("")
			: '<li class="empty">No templates found. Create .hbs files in templates/emails/</li>'

		return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      padding: 40px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      color: #333;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 32px;
    }
    .templates {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .templates h2 {
      padding: 16px 20px;
      background: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
      font-size: 14px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    ul {
      list-style: none;
    }
    li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      border-bottom: 1px solid #e9ecef;
    }
    li:last-child { border-bottom: none; }
    li.empty {
      color: #999;
      font-style: italic;
    }
    .template-link {
      color: #0066cc;
      text-decoration: none;
      font-weight: 500;
    }
    .template-link:hover { text-decoration: underline; }
    .template-actions a {
      margin-left: 12px;
      text-decoration: none;
      opacity: 0.6;
    }
    .template-actions a:hover { opacity: 1; }
    .status {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 8px 16px;
      background: #28a745;
      color: white;
      border-radius: 4px;
      font-size: 14px;
    }
    .status.disconnected { background: #dc3545; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Email Preview</h1>
    <p class="subtitle">Select a template to preview</p>

    <div class="templates">
      <h2>Available Templates</h2>
      <ul>${templateList}</ul>
    </div>
  </div>

  <div class="status" id="status">Connected</div>

  <script>
    const status = document.getElementById('status');
    let ws;

    function connect() {
      ws = new WebSocket('ws://' + location.host);

      ws.onopen = () => {
        status.textContent = 'Connected';
        status.className = 'status';
      };

      ws.onclose = () => {
        status.textContent = 'Disconnected';
        status.className = 'status disconnected';
        setTimeout(connect, 2000);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'reload') {
          location.reload();
        }
      };
    }

    connect();
  </script>
</body>
</html>`
	}

	/**
	 * Render the preview page wrapper
	 */
	private _renderPreviewPage(
		templateName: string,
		result: CompileResult
	): string {
		return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview: ${templateName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #e9ecef;
    }
    .toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 48px;
      background: #343a40;
      display: flex;
      align-items: center;
      padding: 0 16px;
      z-index: 100;
      gap: 16px;
    }
    .toolbar a {
      color: white;
      text-decoration: none;
      opacity: 0.8;
    }
    .toolbar a:hover { opacity: 1; }
    .toolbar .title {
      color: white;
      font-weight: 500;
      flex: 1;
    }
    .toolbar .viewport-btns {
      display: flex;
      gap: 8px;
    }
    .toolbar button {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      background: #495057;
      color: white;
      cursor: pointer;
    }
    .toolbar button:hover { background: #6c757d; }
    .toolbar button.active { background: #0066cc; }
    .preview-container {
      margin-top: 48px;
      padding: 24px;
      display: flex;
      justify-content: center;
    }
    .preview-frame {
      background: white;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      transition: width 0.3s ease;
      width: 100%;
      max-width: 800px;
    }
    .preview-frame.mobile { max-width: 375px; }
    .preview-frame.tablet { max-width: 768px; }
    iframe {
      width: 100%;
      border: none;
      height: calc(100vh - 96px);
    }
    .status {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 8px 16px;
      background: #28a745;
      color: white;
      border-radius: 4px;
      font-size: 14px;
    }
    .status.disconnected { background: #dc3545; }
  </style>
</head>
<body>
  <div class="toolbar">
    <a href="/">← Back</a>
    <span class="title">${templateName}${result.subject ? ` — ${result.subject}` : ""}</span>
    <div class="viewport-btns">
      <button onclick="setViewport('mobile')" title="Mobile (375px)">📱</button>
      <button onclick="setViewport('tablet')" title="Tablet (768px)">📱</button>
      <button onclick="setViewport('desktop')" class="active" title="Desktop (800px)">🖥️</button>
    </div>
    <a href="/preview/${templateName}?raw=true" target="_blank">Raw HTML</a>
    <a href="/preview/${templateName}/text" target="_blank">Plain Text</a>
  </div>

  <div class="preview-container">
    <div class="preview-frame" id="frame">
      <iframe id="preview" srcdoc="${this._escapeHtml(result.html)}"></iframe>
    </div>
  </div>

  <div class="status" id="status">Connected</div>

  <script>
    const frame = document.getElementById('frame');
    const buttons = document.querySelectorAll('.viewport-btns button');

    function setViewport(size) {
      frame.className = 'preview-frame ' + (size === 'desktop' ? '' : size);
      buttons.forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
    }

    // WebSocket for hot reload
    const status = document.getElementById('status');
    let ws;

    function connect() {
      ws = new WebSocket('ws://' + location.host);

      ws.onopen = () => {
        status.textContent = 'Connected';
        status.className = 'status';
      };

      ws.onclose = () => {
        status.textContent = 'Disconnected';
        status.className = 'status disconnected';
        setTimeout(connect, 2000);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'reload') {
          location.reload();
        } else if (msg.type === 'error') {
          alert('Error: ' + msg.message);
        }
      };
    }

    connect();
  </script>
</body>
</html>`
	}

	/**
	 * Render error page
	 */
	private _renderErrorPage(error: Error): string {
		return `
<!DOCTYPE html>
<html>
<head>
  <title>Error</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #fee;
      padding: 40px;
    }
    .error {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 { color: #c00; margin-bottom: 16px; }
    pre {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 4px;
      overflow-x: auto;
    }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <div class="error">
    <h1>Template Error</h1>
    <p>${this._escapeHtml(error.message)}</p>
    ${error.stack ? `<pre>${this._escapeHtml(error.stack)}</pre>` : ""}
    <p><a href="/">← Back to templates</a></p>
  </div>

  <script>
    // Still try to connect for hot reload
    const ws = new WebSocket('ws://' + location.host);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'reload') location.reload();
    };
  </script>
</body>
</html>`
	}

	/**
	 * Escape HTML for safe embedding
	 */
	private _escapeHtml(str: string): string {
		return str
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;")
	}
}

export default PreviewServer

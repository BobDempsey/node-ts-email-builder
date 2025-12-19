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
				this.server?.close(() => resolve())
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
          <li class="template-card group">
            <a href="/preview/${t}" class="text-primary-600 hover:text-primary-700 dark:text-primary-500 dark:hover:text-primary-400 font-medium hover:underline">${t}</a>
            <span class="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <a href="/preview/${t}?raw=true" target="_blank" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Raw HTML">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
                </svg>
              </a>
              <a href="/preview/${t}/text" target="_blank" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Plain text">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </a>
            </span>
          </li>
        `
					)
					.join("")
			: '<li class="px-5 py-8 text-center text-gray-500 dark:text-gray-400 italic">No templates found. Create .hbs files in templates/emails/</li>'

		return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Preview</title>
  <link rel="stylesheet" href="/css/styles.css">
  <script>
    (function() {
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.classList.add('dark');
      }
    })();
  </script>
</head>
<body class="min-h-screen bg-gray-100 dark:bg-gray-900">
  <div class="max-w-4xl mx-auto px-6 py-12">
    <!-- Header -->
    <div class="mb-8 flex items-start justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Email Preview</h1>
        <p class="text-gray-600 dark:text-gray-400">Select a template to preview</p>
      </div>
      <button id="theme-toggle" class="theme-toggle-index" title="Toggle dark mode">
        <svg class="w-5 h-5 hidden dark:block" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
        </svg>
        <svg class="w-5 h-5 block dark:hidden" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
        </svg>
      </button>
    </div>

    <!-- Templates Card -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      <div class="px-5 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
          Available Templates
        </h2>
      </div>
      <ul class="divide-y divide-gray-200 dark:divide-gray-700">${templateList}</ul>
    </div>

    <!-- Quick Stats -->
    <div class="mt-8 grid grid-cols-1 gap-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
        <p class="text-2xl font-bold text-primary-600">${templates.length}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400">Template${templates.length !== 1 ? "s" : ""}</p>
      </div>
    </div>
  </div>

  <div class="status-indicator connected" id="status">Connected</div>

  <script>
    const status = document.getElementById('status');
    const themeToggle = document.getElementById('theme-toggle');
    let ws;

    // Theme toggle
    themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        document.documentElement.classList.toggle('dark', e.matches);
      }
    });

    function connect() {
      ws = new WebSocket('ws://' + location.host);

      ws.onopen = () => {
        status.textContent = 'Connected';
        status.className = 'status-indicator connected';
      };

      ws.onclose = () => {
        status.textContent = 'Disconnected';
        status.className = 'status-indicator disconnected';
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
  <link rel="stylesheet" href="/css/styles.css">
  <script>
    (function() {
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.classList.add('dark');
      }
    })();
  </script>
</head>
<body class="bg-gray-200 dark:bg-gray-900">
  <!-- Toolbar -->
  <div class="fixed top-0 left-0 right-0 h-14 bg-gray-800 flex items-center px-4 z-50 gap-4 shadow-lg">
    <a href="/" class="text-white/80 hover:text-white flex items-center gap-2 transition-colors">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
      </svg>
      Back
    </a>

    <div class="h-6 w-px bg-gray-600"></div>

    <span class="text-white font-medium flex-1 truncate">
      ${templateName}${result.subject ? `<span class="text-gray-400 font-normal ml-2">— ${result.subject}</span>` : ""}
    </span>

    <!-- Viewport Controls -->
    <div class="flex gap-1 bg-gray-700/50 rounded-lg p-1">
      <button onclick="setViewport('mobile')" class="viewport-btn" data-size="mobile" title="Mobile (375px)">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
        </svg>
      </button>
      <button onclick="setViewport('tablet')" class="viewport-btn" data-size="tablet" title="Tablet (768px)">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5h3m-6.75 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-15a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 4.5v15a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      </button>
      <button onclick="setViewport('desktop')" class="viewport-btn active" data-size="desktop" title="Desktop (800px)">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
        </svg>
      </button>
    </div>

    <div class="h-6 w-px bg-gray-600"></div>

    <!-- Theme Toggle -->
    <button id="theme-toggle" class="theme-toggle" title="Toggle dark mode">
      <svg class="w-5 h-5 hidden dark:block" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
      </svg>
      <svg class="w-5 h-5 block dark:hidden" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
      </svg>
    </button>

    <div class="h-6 w-px bg-gray-600"></div>

    <!-- Action Links -->
    <a href="/preview/${templateName}?raw=true" target="_blank" class="text-white/80 hover:text-white text-sm flex items-center gap-1 transition-colors">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
      </svg>
      HTML
    </a>
    <a href="/preview/${templateName}/text" target="_blank" class="text-white/80 hover:text-white text-sm flex items-center gap-1 transition-colors">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
      Text
    </a>
  </div>

  <!-- Preview Container -->
  <div class="mt-14 p-6 flex justify-center min-h-[calc(100vh-56px)]">
    <div id="frame" class="bg-white shadow-2xl transition-all duration-300 ease-out w-full max-w-[800px] rounded-lg overflow-hidden">
      <iframe id="preview" class="w-full border-none h-[calc(100vh-104px)]" srcdoc="${this._escapeHtml(result.html)}"></iframe>
    </div>
  </div>

  <div class="status-indicator connected" id="status">Connected</div>

  <script>
    const frame = document.getElementById('frame');
    const buttons = document.querySelectorAll('.viewport-btn');
    const themeToggle = document.getElementById('theme-toggle');

    function setViewport(size) {
      // Reset all buttons
      buttons.forEach(b => b.classList.remove('active'));

      // Update frame size
      frame.classList.remove('max-w-[375px]', 'max-w-[768px]', 'max-w-[800px]');

      if (size === 'mobile') {
        frame.classList.add('max-w-[375px]');
      } else if (size === 'tablet') {
        frame.classList.add('max-w-[768px]');
      } else {
        frame.classList.add('max-w-[800px]');
      }

      // Highlight active button
      document.querySelector('[data-size="' + size + '"]').classList.add('active');
    }

    // Theme toggle
    themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        document.documentElement.classList.toggle('dark', e.matches);
      }
    });

    // WebSocket for hot reload
    const status = document.getElementById('status');
    let ws;

    function connect() {
      ws = new WebSocket('ws://' + location.host);

      ws.onopen = () => {
        status.textContent = 'Connected';
        status.className = 'status-indicator connected';
      };

      ws.onclose = () => {
        status.textContent = 'Disconnected';
        status.className = 'status-indicator disconnected';
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
  <link rel="stylesheet" href="/css/styles.css">
  <script>
    (function() {
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.classList.add('dark');
      }
    })();
  </script>
</head>
<body class="min-h-screen bg-red-50 dark:bg-gray-900 p-10">
  <div class="max-w-3xl mx-auto">
    <!-- Error Card -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      <!-- Error Header -->
      <div class="bg-red-600 px-6 py-4">
        <div class="flex items-center gap-3">
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <h1 class="text-xl font-bold text-white">Template Error</h1>
        </div>
      </div>

      <!-- Error Content -->
      <div class="p-6">
        <p class="text-gray-800 dark:text-gray-200 mb-4 text-lg">${this._escapeHtml(error.message)}</p>

        ${
					error.stack
						? `
        <details class="mt-4">
          <summary class="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium">
            Stack Trace
          </summary>
          <pre class="mt-2 bg-gray-100 dark:bg-gray-700 p-4 rounded-lg text-sm overflow-x-auto text-gray-700 dark:text-gray-300">${this._escapeHtml(error.stack)}</pre>
        </details>
        `
						: ""
				}

        <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <a href="/" class="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 dark:text-primary-500 dark:hover:text-primary-400 font-medium transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to templates
          </a>
        </div>
      </div>
    </div>
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

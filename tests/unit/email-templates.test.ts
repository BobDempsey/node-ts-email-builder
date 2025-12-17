import EmailBuilder from "@/email-builder"

describe("Email Templates", () => {
	let builder: EmailBuilder

	beforeAll(async () => {
		builder = new EmailBuilder()
		await builder.init()
	})

	describe("welcome template", () => {
		it("should compile with sample data", async () => {
			const result = await builder.compile("welcome")

			expect(result).toHaveProperty("html")
			expect(result).toHaveProperty("text")
			expect(result).toHaveProperty("subject")
			expect(result.html.length).toBeGreaterThan(0)
			expect(result.text.length).toBeGreaterThan(0)
		})

		it("should extract subject line with company name", async () => {
			const result = await builder.compile("welcome")

			expect(result.subject).toBe("Welcome to Acme Inc!")
		})

		it("should include user greeting in HTML", async () => {
			const result = await builder.compile("welcome")

			expect(result.html).toContain("Welcome, John!")
		})

		it("should include verification button when required", async () => {
			const result = await builder.compile("welcome")

			expect(result.html).toContain("Verify Email Address")
		})

		it("should generate plain text with key content", async () => {
			const result = await builder.compile("welcome")

			expect(result.text).toContain("WELCOME, JOHN!")
			expect(result.text).toContain("Acme Inc")
		})
	})

	describe("contact-form-notification template", () => {
		it("should compile with sample data", async () => {
			const result = await builder.compile("contact-form-notification")

			expect(result).toHaveProperty("html")
			expect(result).toHaveProperty("text")
			expect(result).toHaveProperty("subject")
			expect(result.html.length).toBeGreaterThan(0)
			expect(result.text.length).toBeGreaterThan(0)
		})

		it("should extract subject line with sender name", async () => {
			const result = await builder.compile("contact-form-notification")

			expect(result.subject).toBe("New Contact Form Submission from Jane Smith")
		})

		it("should include sender details in HTML", async () => {
			const result = await builder.compile("contact-form-notification")

			expect(result.html).toContain("Jane Smith")
			expect(result.html).toContain("jane.smith@example.com")
			expect(result.html).toContain("(555) 123-4567")
		})

		it("should include submission message in HTML", async () => {
			const result = await builder.compile("contact-form-notification")

			expect(result.html).toContain("Question about your services")
			expect(result.html).toContain("enterprise solutions")
		})

		it("should include reply button", async () => {
			const result = await builder.compile("contact-form-notification")

			expect(result.html).toContain("Reply to Message")
		})

		it("should generate plain text with key content", async () => {
			const result = await builder.compile("contact-form-notification")

			expect(result.text).toContain("Jane Smith")
			expect(result.text).toContain("Question about your services")
		})
	})

	describe("contact-form-confirmation template", () => {
		it("should compile with sample data", async () => {
			const result = await builder.compile("contact-form-confirmation")

			expect(result).toHaveProperty("html")
			expect(result).toHaveProperty("text")
			expect(result).toHaveProperty("subject")
			expect(result.html.length).toBeGreaterThan(0)
			expect(result.text.length).toBeGreaterThan(0)
		})

		it("should extract subject line with sender first name", async () => {
			const result = await builder.compile("contact-form-confirmation")

			expect(result.subject).toBe("We received your message, Jane!")
		})

		it("should include personalized greeting", async () => {
			const result = await builder.compile("contact-form-confirmation")

			expect(result.html).toContain("Thanks for reaching out, Jane!")
		})

		it("should include response time", async () => {
			const result = await builder.compile("contact-form-confirmation")

			expect(result.html).toContain("24-48 hours")
		})

		it("should include copy of submitted message", async () => {
			const result = await builder.compile("contact-form-confirmation")

			expect(result.html).toContain("Question about your services")
			expect(result.html).toContain("enterprise solutions")
		})

		it("should include company contact information", async () => {
			const result = await builder.compile("contact-form-confirmation")

			expect(result.html).toContain("support@example.com")
		})

		it("should generate plain text with key content", async () => {
			const result = await builder.compile("contact-form-confirmation")

			expect(result.text).toContain("JANE")
			expect(result.text).toContain("24-48 hours")
		})
	})

	describe("template listing", () => {
		it("should list all available templates", async () => {
			const templates = await builder.listTemplates()

			expect(templates).toContain("welcome")
			expect(templates).toContain("contact-form-notification")
			expect(templates).toContain("contact-form-confirmation")
			expect(templates.length).toBe(3)
		})
	})
})

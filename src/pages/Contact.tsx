import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const FORM_ENDPOINT = "https://formspree.io/f/xykjjvdb";

export default function Contact() {
  return (
    <div className="max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
        <p className="text-muted-foreground">
          Tell me what you’re making and what you need. I’ll reply with next steps and timing.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-4 p-6">
          <form action={FORM_ENDPOINT} method="POST" className="space-y-4">
            {/* Helpful subject line in your inbox */}
            <input
              type="hidden"
              name="_subject"
              value="New message from stabileusa.com"
            />

            {/* Optional: redirect after submit (create /thanks later or remove this) */}
            <input
              type="hidden"
              name="_next"
              value="https://stabileusa.com/thanks"
            />

            {/* Honeypot field to reduce spam */}
            <input
              type="text"
              name="_gotcha"
              style={{ display: "none" }}
              tabIndex={-1}
              autoComplete="off"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="name">
                  Name
                </label>
                <Input id="name" name="name" placeholder="Your name" required />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  name="email"
                  placeholder="you@example.com"
                  type="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="message">
                What do you need?
              </label>
              <Textarea
                id="message"
                name="message"
                placeholder="IVR prompts, narration, explainer, etc. Include word count + deadline if you have it."
                required
              />
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit">Send</Button>

              <a
                className="text-sm text-muted-foreground hover:text-foreground"
                href="mailto:agentpamelajterrell@gmail.com"
              >
                or email: agentpamelajterrell@gmail.com
              </a>
            </div>

            <p className="text-xs text-muted-foreground">
              After sending, you’ll see a confirmation page.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

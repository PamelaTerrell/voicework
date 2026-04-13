import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const FORM_ENDPOINT = "https://formspree.io/f/xykjjvdb";

export default function Contact() {
  return (
    <div className="max-w-2xl space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
        <p className="max-w-xl leading-7 text-muted-foreground">
          For voice narration, website projects, creative collaborations, or
          membership support, send a note below. I’d love to hear from you.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border">
          <CardContent className="space-y-2 p-5">
            <p className="font-medium">Voice work</p>
            <p className="text-sm text-muted-foreground">
              Professional voice work for storytelling, brand narration, and
              audio-driven experiences. A calm, clear, and emotionally grounded
              voice with the ability to adapt tone, pacing, and delivery across
              different formats and projects.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border">
          <CardContent className="space-y-2 p-5">
            <p className="font-medium">Web design & development</p>
            <p className="text-sm text-muted-foreground">
              Thoughtful, modern websites designed with clarity, structure, and
              a refined user experience.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border">
          <CardContent className="space-y-2 p-5">
            <p className="font-medium">Creative collaborations</p>
            <p className="text-sm text-muted-foreground">
              Select collaborations that align with storytelling, human
              behavior, and meaningful digital experiences.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-2xl border">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Work with me</p>
            <p className="text-sm text-muted-foreground">
              This form is open for voice narration inquiries, website design
              and development projects, creative collaborations, listener
              messages, and membership support.
            </p>
          </div>

          <form action={FORM_ENDPOINT} method="POST" className="space-y-4">
            <input
              type="hidden"
              name="_subject"
              value="New message from stabileusa.com"
            />

            <input
              type="hidden"
              name="_next"
              value="https://stabileusa.com/contact-thanks"
            />

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
                  type="email"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="message">
                Message
              </label>
              <Textarea
                id="message"
                name="message"
                placeholder="Tell me a little about your inquiry. For voice work, include project type, word count, usage, and timeline. For websites, include the type of site, your goals, and timeline."
                className="min-h-[170px]"
                required
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button type="submit">Send message</Button>

              <a
                className="text-sm text-muted-foreground transition hover:text-foreground"
                href="mailto:listen@stabileusa.com"
              >
                or email: listen@stabileusa.com
              </a>
            </div>

            <p className="text-xs leading-5 text-muted-foreground">
              You can use this form for voice narration, website inquiries,
              creative collaborations, listener messages, or membership help.
              After sending, you’ll see a confirmation page.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
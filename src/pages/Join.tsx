import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const FORM_ENDPOINT = "https://formspree.io/f/xykjjvdb";

export default function Join() {
  return (
    <div className="max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Join the Night List</h1>
        <p className="text-muted-foreground">
          Get new episode releases, cozy late-night notes, and early access as the library grows.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="rounded-2xl border bg-muted p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Founding listeners</p>
            <p className="mt-1">
              You’re early. When memberships launch, the Night List will get first access and a
              founding-listener perk.
            </p>
          </div>

          <form action={FORM_ENDPOINT} method="POST" className="space-y-4">
            {/* Tag in your inbox */}
            <input type="hidden" name="_subject" value="Night List signup (stabileusa.com)" />
            <input type="hidden" name="type" value="night_list" />

            {/* redirect after submit */}
            <input type="hidden" name="_next" value="https://stabileusa.com/thanks" />

            {/* Honeypot */}
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
                  Name (optional)
                </label>
                <Input id="name" name="name" placeholder="Your name" />
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
              <label className="text-sm font-medium" htmlFor="interest">
                What do you want more of? (optional)
              </label>
              <Input
                id="interest"
                name="interest"
                placeholder="Loneliness, belonging, social norms, identity, relationships…"
              />
            </div>

            <Button type="submit" className="w-full">
              Join the Night List
            </Button>

            <p className="text-xs text-muted-foreground">
              No spam. Just new episodes and occasional cozy notes.
            </p>
          </form>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        Prefer email?{" "}
        <a
          className="underline underline-offset-4 hover:text-foreground"
          href="mailto:agentpamelajterrell@gmail.com?subject=Night%20List%20Signup"
        >
          Send a quick note
        </a>
        .
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function Contact() {
  return (
    <div className="space-y-8 max-w-2xl">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
        <p className="text-muted-foreground">
          Tell me what you’re making and what you need. I’ll reply with next steps and timing.
        </p>
      </header>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input placeholder="you@example.com" type="email" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">What do you need?</label>
            <Textarea placeholder="IVR prompts, narration, explainer, etc. Include word count + deadline if you have it." />
          </div>

          <div className="flex items-center gap-3">
            <Button type="button">Send</Button>
            <a
  className="text-sm text-muted-foreground hover:text-foreground"
  href="mailto:agentpamelajterrell@gmail.com"
>
  or email: agentpamelajterrell@gmail.com
</a>

          </div>

          <p className="text-xs text-muted-foreground">
            (Form is UI-only for now; we can wire it up later to Formspree or a simple API.)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

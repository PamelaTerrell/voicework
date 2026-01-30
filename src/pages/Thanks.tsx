import { Card, CardContent } from "@/components/ui/card";

export default function Thanks() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Thank you!</h1>
        <p className="text-muted-foreground">
          Your message was sent successfully. I’ll get back to you as soon as I can.
        </p>
      </header>

      <Card className="overflow-hidden">
        <CardContent className="space-y-4 p-6">
          <div className="rounded-2xl border bg-background p-5">
            <p className="text-sm font-medium">What happens next</p>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li>• I’ll reply with timing and any clarifying questions</li>
              <li>• If you have a script, feel free to include it in your reply</li>
              <li>• Delivery formats available: WAV or MP3</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="/demos"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:brightness-105 hover:shadow-md active:translate-y-[1px]"
            >
              Listen to demos
            </a>

            <a
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-md border bg-background px-6 text-sm font-medium shadow-sm transition-all hover:bg-muted active:translate-y-[1px]"
            >
              Back to home
            </a>
          </div>

          <p className="text-xs text-muted-foreground">
            Prefer email?{" "}
            <a
              className="underline underline-offset-4 hover:text-foreground"
              href="mailto:agentpamelajterrell@gmail.com"
            >
              agentpamelajterrell@gmail.com
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

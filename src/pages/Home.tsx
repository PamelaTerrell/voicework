import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border bg-background p-6 sm:p-10">
        {/* soft color spotlight */}
        <div className="pointer-events-none absolute -top-24 right-[-6rem] h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-[-6rem] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />

        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <div className="w-fit rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground">
              Voice • IVR • Narration
            </div>

            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                A clear, human voice
              </span>{" "}
              for modern communication.
            </h1>

            <p className="text-lg text-muted-foreground">
              Calm, natural voice recordings for phone systems, narration, and informational
              content—designed to sound real, trustworthy, and easy to listen to.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="/demos"
                className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:brightness-105 hover:shadow-md active:translate-y-[1px]"
              >
                Hear a sample
              </a>

              <a
                href="/contact"
                className="inline-flex h-11 items-center justify-center rounded-md border bg-background px-6 text-sm font-medium shadow-sm transition-all hover:bg-muted active:translate-y-[1px]"
              >
                Request a custom read
              </a>
            </div>

            <p className="text-sm text-muted-foreground">
              Fast turnaround • Friendly communication • Broadcast-ready delivery
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border bg-background p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Signature style</p>
              <p className="mt-1 text-xl font-medium">Calm • Clear • Trustworthy</p>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p>• Phone system prompts (IVR)</p>
                <p>• Corporate / explainer narration</p>
                <p>• Training & onboarding voiceover</p>
              </div>
            </div>

            <div className="rounded-2xl border bg-muted p-5">
              <p className="text-sm font-medium">Coming soon</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Fresh demos recorded with your new mic—IVR, corporate narration, and calm commercial
                reads.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <CardContent className="space-y-2 p-6">
            <p className="font-medium">Human-sounding clarity</p>
            <p className="text-sm text-muted-foreground">
              A real-person tone that’s calm and credible—ideal for customer-facing audio.
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <CardContent className="space-y-2 p-6">
            <p className="font-medium">Easy collaboration</p>
            <p className="text-sm text-muted-foreground">
              Simple process, clear revisions, and delivery formats that work for your team.
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <CardContent className="space-y-2 p-6">
            <p className="font-medium">Professional delivery</p>
            <p className="text-sm text-muted-foreground">
              Clean files, consistent levels, and an organized library as you grow.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

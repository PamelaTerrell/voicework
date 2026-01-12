import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div className="space-y-6">
          <Badge variant="secondary" className="w-fit">
            Voice • IVR • Narration
          </Badge>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            A clear, human voice for modern communication.
          </h1>

          <p className="text-lg text-muted-foreground">
            Calm, natural voice recordings for phone systems, narration, and informational content—
            designed to sound real, trustworthy, and easy to listen to.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <a href="/demos">Hear a sample</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="/contact">Request a custom read</a>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Fast turnaround • Friendly communication • Broadcast-ready delivery
          </p>
        </div>

        {/* Hero card */}
        <Card className="overflow-hidden">
          <CardContent className="space-y-5 p-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Signature style</p>
              <p className="text-xl font-medium">Calm • Clear • Trustworthy</p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">Best-fit work</p>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                <li>• Phone system prompts (IVR)</li>
                <li>• Corporate / explainer narration</li>
                <li>• Training & onboarding voiceover</li>
              </ul>
            </div>

            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium">Coming soon</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Fresh demos recorded with new mic—IVR, corporate narration, and calm commercial reads.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Feature cards */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6 space-y-2">
            <p className="font-medium">Human-sounding clarity</p>
            <p className="text-sm text-muted-foreground">
              A real-person tone that’s calm and credible—ideal for customer-facing audio.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-2">
            <p className="font-medium">Easy collaboration</p>
            <p className="text-sm text-muted-foreground">
              Simple process, clear revisions, and delivery formats that work for your team.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-2">
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

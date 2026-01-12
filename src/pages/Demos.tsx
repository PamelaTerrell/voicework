import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function DemoCard({ title, desc }: { title: string; desc: string }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-2">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
        <div className="mt-3 rounded-lg border p-3 text-sm text-muted-foreground">
          🎧 Audio sample coming soon
        </div>
      </CardContent>
    </Card>
  );
}

export default function Demos() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Demos</h1>
        <p className="text-muted-foreground">
          I’m building a demo library now. If you’d like a custom read for your script, I can do that.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <DemoCard title="IVR / Phone System" desc="Friendly, clear prompts for menus and routing." />
        <DemoCard title="Corporate Narration" desc="Confident, calm reads for training and explainers." />
        <DemoCard title="Calm Commercial" desc="Warm, trustworthy tone—never hypey." />
      </div>

      <div className="flex gap-3">
        <Button asChild>
          <a href="/contact">Request a custom read</a>
        </Button>
        <Button asChild variant="outline">
          <a href="/">Back to home</a>
        </Button>
      </div>
    </div>
  );
}

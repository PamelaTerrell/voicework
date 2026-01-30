import { Card, CardContent } from "@/components/ui/card";

function DemoPlayer({
  title,
  description,
  src,
}: {
  title: string;
  description: string;
  src: string;
}) {
  return (
    <Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <CardContent className="space-y-4 p-6">
        <div>
          <p className="text-lg font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <audio controls className="w-full">
          <source src={src} type="audio/wav" />
          Your browser does not support the audio element.
        </audio>
      </CardContent>
    </Card>
  );
}

export default function Demos() {
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Voice Demos</h1>
        <p className="text-muted-foreground">
          A selection of recent recordings. Custom reads available on request.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        <DemoPlayer
          title="Short Story"
          description="A short story."
          src="/audio/shortstory.wav"
        />

        <DemoPlayer
          title="Commercial"
          description="Warm, friendly, and conversational delivery for brand messaging."
          src="/audio/Commercial.wav"
        />

        <DemoPlayer
          title="Corporate Narration"
          description="Clear, professional tone for training and informational content."
          src="/audio/Corporate.wav"
        />

        <DemoPlayer
          title="IVR / Phone System"
          description="Neutral, calm voice for menus, routing, and customer support systems."
          src="/audio/IVR.wav"
        />
      </section>
    </div>
  );
}

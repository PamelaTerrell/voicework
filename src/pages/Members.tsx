import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function stopOtherAudio(current: HTMLAudioElement) {
  document.querySelectorAll("audio").forEach((a) => {
    if (a !== current) a.pause();
  });
}

export default function Members() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      {/* Header */}
      <header className="space-y-3">
        <Badge className="w-fit">Members</Badge>

        <h1 className="text-3xl font-semibold tracking-tight">
          Your listening room
        </h1>

        <p className="text-muted-foreground max-w-xl">
          Thank you for supporting this work. You now have access to full bedtime-length
          episodes. New releases will appear here automatically.
        </p>
      </header>

      {/* Episode */}
      <Card className="overflow-hidden rounded-2xl shadow-sm">
        
        {/* Episode Image */}
        <div className="relative">
          <img
            src="/images/why-mind-replays-thumbnail.png"
            alt="Why Your Mind Replays Conversations at Night"
            className="h-64 w-full object-cover"
            loading="lazy"
          />

          <div className="absolute top-3 right-3">
            <Badge>Full Access</Badge>
          </div>
        </div>

        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-medium">
              Why Your Mind Replays Conversations at Night
            </h2>

            <p className="text-sm text-muted-foreground">
              A gentle bedtime reflection on why the mind revisits moments,
              and how those quiet replays are often an attempt to protect
              connection and emotional safety.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="outline">bedtime</Badge>
              <Badge variant="outline">calm</Badge>
              <Badge variant="outline">human behavior</Badge>
              <Badge variant="outline">mind</Badge>
            </div>
          </div>

          {/* Full Audio Player */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Full episode</p>
              <Badge variant="secondary">Unlocked</Badge>
            </div>

            <audio
              controls
              preload="none"
              className="w-full"
              onPlay={(e) => stopOtherAudio(e.currentTarget)}
            >
              <source
                src="/audio/why-mind-replays-conversations-full.mp3"
                type="audio/mpeg"
              />
              Your browser does not support the audio element.
            </audio>
          </div>

          <p className="text-xs text-muted-foreground">
            Tip: headphones + low volume works best for bedtime listening.
          </p>
        </CardContent>
      </Card>

      {/* Coming Soon */}
      <section className="rounded-3xl border bg-background p-6">
        <p className="font-medium">More episodes coming soon</p>

        <p className="text-sm text-muted-foreground mt-1">
          Your membership gives you access to all future full-length episodes.
        </p>
      </section>

      {/* Navigation */}
      <div className="flex gap-3">
        <Button asChild variant="outline">
          <Link to="/listen">Browse previews</Link>
        </Button>

        <Button asChild variant="outline">
          <Link to="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}

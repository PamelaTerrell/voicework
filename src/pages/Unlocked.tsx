import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function stopOtherAudio(current: HTMLAudioElement) {
  document.querySelectorAll("audio").forEach((a) => {
    if (a !== current) a.pause();
  });
}

export default function Unlocked() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      {/* Header */}
      <header className="space-y-3">
        <Badge className="w-fit">Unlocked</Badge>

        <h1 className="text-3xl font-semibold tracking-tight">
          Your episode is ready
        </h1>

        <p className="text-muted-foreground max-w-xl">
          Thank you for supporting Stabile USA. You now have access to the full episode.
        </p>
      </header>

      {/* Episode Card */}
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
            <Badge>Full Episode</Badge>
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

          {/* Membership Upsell */}
          <div className="rounded-2xl border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium">
              Want unlimited access?
            </p>

            <p className="text-sm text-muted-foreground">
              Membership unlocks all current and future episodes.
            </p>

            <Button asChild className="w-full sm:w-auto">
              <a
                href="https://buy.stripe.com/bJeeV6bIS8EW27T4Th2cg02"
                target="_blank"
                rel="noreferrer"
              >
                Unlock All Episodes — $4.99/month
              </a>
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex gap-3">
        <Button asChild variant="outline">
          <Link to="/listen">Back to previews</Link>
        </Button>

        <Button asChild variant="outline">
          <Link to="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}

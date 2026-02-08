import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Unlocked() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Payment received</h1>
          <Badge variant="secondary" className="font-normal">
            Unlocked
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Thank you for supporting Stabile USA. Your full episode is ready below.
        </p>
      </header>

      <Card className="overflow-hidden">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-1">
            <p className="text-xl font-medium">Why Your Mind Replays Conversations at Night</p>
            <p className="text-sm text-muted-foreground">
              Full episode — cozy, calm, and made for winding down.
            </p>
          </div>

          <div className="rounded-2xl border bg-muted/20 p-4 space-y-3">
            <p className="text-sm font-medium">Full Episode</p>
            <audio controls preload="none" className="w-full">
              <source
                src="/audio/why-mind-replays-conversations-full.mp3"
                type="audio/mpeg"
              />
              Your browser does not support the audio element.
            </audio>

            <p className="text-xs text-muted-foreground">
              Tip: If you don’t hear audio, raise your device volume, disable Silent Mode, and try
              headphones.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-11">
              <Link to="/listen">Back to Listen</Link>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link to="/">Home</Link>
            </Button>
          </div>

          <div className="rounded-2xl border bg-background p-4">
            <p className="text-sm font-medium">Want unlimited access?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A membership unlocks all episodes as the library grows.
            </p>
            <Button asChild className="mt-3 w-full sm:w-auto">
              <Link to="/listen">See options</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        If you ever have trouble accessing audio, email{" "}
        <a
          className="underline underline-offset-4 hover:text-foreground"
          href="mailto:agentpamelajterrell@gmail.com"
        >
          agentpamelajterrell@gmail.com
        </a>
        .
      </p>
    </div>
  );
}

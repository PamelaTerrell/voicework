import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Members() {
  const [episodeId, setEpisodeId] = useState("replays-ep1");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  async function fetchSignedUrl() {
    setStatus("");
    setSignedUrl(null);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setStatus("Please sign in first (magic link).");
      return;
    }

    const r = await fetch(`/api/signed-audio?episodeId=${encodeURIComponent(episodeId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const j = await r.json();
    if (!r.ok) {
      setStatus(j.error || "Not entitled");
      return;
    }

    setSignedUrl(j.url);
    setStatus("Unlocked ✅");
  }

  useEffect(() => {
    fetchSignedUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Members</h1>
        <p className="text-muted-foreground max-w-2xl">
          Full episodes live here. If you subscribed or unlocked an episode, this will load a secure signed URL.
        </p>
      </header>

      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <p className="text-sm font-medium">Episode ID</p>
              <p className="text-xs text-muted-foreground">Must match storage path: episodes/&lt;episodeId&gt;/full.mp3</p>
            </div>

            <Badge variant="secondary" className="font-normal">
              {episodeId}
            </Badge>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" onClick={() => setEpisodeId("replays-ep1")}>
              replays-ep1
            </Button>
            {/* add more quick buttons if you want */}
          </div>

          <div className="flex gap-2">
            <Button onClick={fetchSignedUrl}>Load / Refresh</Button>
            <Button
              variant="outline"
              onClick={() => {
                setSignedUrl(null);
                setStatus("");
              }}
            >
              Clear
            </Button>
          </div>

          {status && <p className="text-sm text-muted-foreground">{status}</p>}

          {signedUrl && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Full Episode</p>
              <audio controls preload="none" className="w-full" src={signedUrl} />
              <p className="text-xs text-muted-foreground">
                Signed URL expires (server sets ~10 minutes). Click Refresh if it stops.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

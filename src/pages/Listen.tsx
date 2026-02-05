import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STRIPE_ONE_TIME_URL =
  "https://buy.stripe.com/14A8wIbIS4oGbItbhF2cg00";

const STRIPE_SUBSCRIBE_URL =
  "https://buy.stripe.com/bJeeV6bIS8EW27T4Th2cg02";

type Episode = {
  id: string;
  title: string;
  description: string;
  thumbnailSrc?: string;
  previewMp3?: string;
  previewWav?: string;
  isPremium?: boolean;
  tags?: string[];
};

// Prevent multiple audios playing at once
function stopOtherAudio(current: HTMLAudioElement) {
  document.querySelectorAll("audio").forEach((a) => {
    if (a !== current) a.pause();
  });
}

function EpisodeCard({ episode }: { episode: Episode }) {
  const {
    title,
    description,
    thumbnailSrc,
    previewMp3,
    previewWav,
    isPremium = false,
    tags = [],
  } = episode;

  return (
    <Card className="transition-all hover:-translate-y-1 hover:shadow-xl rounded-2xl overflow-hidden">
      {thumbnailSrc && (
        <div className="relative">
          <img
            src={thumbnailSrc}
            alt={`${title} thumbnail`}
            className="h-48 w-full object-cover"
            loading="lazy"
          />
          <div className="absolute top-3 right-3">
            <Badge>Preview</Badge>
          </div>
        </div>
      )}

      <CardContent className="space-y-5 p-6">
        <div className="space-y-2">
          <p className="text-lg font-medium leading-snug">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {tags.map((t: string) => (
                <Badge key={t} variant="outline" className="font-normal">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Preview Player */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Free Preview</p>
            <Badge variant="secondary" className="font-normal">
              3:00
            </Badge>
          </div>

          <audio
            controls
            preload="none"
            className="w-full"
            onPlay={(e) => stopOtherAudio(e.currentTarget)}
          >
            {previewMp3 && <source src={previewMp3} type="audio/mpeg" />}
            {previewWav && <source src={previewWav} type="audio/wav" />}
            Your browser does not support the audio element.
          </audio>
        </div>

        {/* Locked Full Episode -> Stripe */}
        {isPremium && (
          <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Full Episode</p>
              <Badge className="font-normal">Paid</Badge>
            </div>

            <p className="text-sm text-muted-foreground">
              Unlock the full bedtime-length episode with membership, or listen once.
              <span className="block mt-1">Cancel anytime.</span>
            </p>

            <div className="space-y-2">
              <Button asChild className="w-full">
                <a href={STRIPE_SUBSCRIBE_URL} target="_blank" rel="noreferrer">
                  Unlock All Episodes — $4.99/month
                </a>
              </Button>

              <Button asChild variant="outline" className="w-full">
                <a href={STRIPE_ONE_TIME_URL} target="_blank" rel="noreferrer">
                  Listen Once — $2.99
                </a>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Secure checkout powered by Stripe.
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Tip: headphones + low volume works best for bedtime listening.
        </p>
      </CardContent>
    </Card>
  );
}

export default function Listen() {
  const episodes: Episode[] = [
    {
      id: "lonely-ep1",
      title: "Why We Feel Lonely Even Around Others",
      description:
        "A calm bedtime story about belonging, connection, and why loneliness can appear even when we’re not physically alone.",
      thumbnailSrc: "/images/why-we-feel-lonely-thumbnail.png",
      previewMp3: "/audio/why-we-feel-lonely-preview.mp3",
      previewWav: "/audio/why-we-feel-lonely-preview.wav",
      isPremium: true,
      tags: ["human behavior", "sociology", "bedtime", "calm"],
    },

    {
  id: "misunderstandings-ep1",
  title: "When Silence Becomes the Loudest Answer",
  description:
    "A calm bedtime reflection on misunderstandings, emotional withdrawal, and how silence can quietly deepen hurt instead of resolving it.",
  thumbnailSrc: "/images/cozyroom.png",
  previewMp3: "/audio/misunderstandings.mp3",
  isPremium: false,
  tags: ["relationships", "communication", "bedtime", "calm"],
}

  ];

  const comingNext: string[] = [
    "Why Humans Crave Belonging",
    "Why Silence Can Feel Uncomfortable",
    "The Hidden Rules of Social Norms",
  ];

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Listen</h1>
          <p className="text-muted-foreground max-w-2xl">
            Cozy late-night previews about human behavior. Calm, story-driven audio designed for
            winding down and quiet listening.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button asChild>
            <Link to="/join">Join</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/contact">Collaborations / Contact</Link>
          </Button>
        </div>
      </header>

      {/* Episodes */}
      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {episodes.map((ep) => (
          <EpisodeCard key={ep.id} episode={ep} />
        ))}
      </section>

      {/* Coming Next */}
      <section className="rounded-3xl border bg-background p-6 sm:p-10">
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-lg font-medium">Coming next</p>
            <p className="text-sm text-muted-foreground">
              New episodes are in production and will appear here soon.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {comingNext.map((t: string) => (
              <div key={t} className="rounded-2xl border bg-muted/30 p-4">
                <p className="text-sm font-medium">{t}</p>
                <p className="mt-1 text-xs text-muted-foreground">In progress</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              Want early access when new episodes drop?
            </p>
            <div className="flex gap-2">
              <Button asChild>
                <Link to="/join">Join</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/">Back to Home</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

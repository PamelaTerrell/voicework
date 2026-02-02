import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
              Cozy late-night listening • Human behavior • Sociology-inspired
            </div>

            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Calm bedtime stories about{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                why we do what we do
              </span>
              .
            </h1>

            <p className="text-lg text-muted-foreground">
              Gentle, story-driven reflections on human behavior—made for winding down, getting
              curious, and feeling a little less alone at night.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-11 px-6">
                <Link to="/listen">Play a free preview</Link>
              </Button>

              <Button asChild variant="outline" className="h-11 px-6">
                <Link to="/join">Join the Night List</Link>
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              New episodes coming regularly • Calm bedtime voice • BA in Sociology
            </p>
          </div>

          {/* Hero card / preview */}
          <div className="space-y-4">
            <div className="rounded-2xl border bg-background p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Tonight’s preview</p>
              <p className="mt-1 text-xl font-medium">
                Why We Feel Lonely Even Around Others
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                A calm walk through loneliness, belonging, and the quiet social needs our minds
                carry.
              </p>

              <div className="mt-4 space-y-2">
                <audio controls preload="none" className="w-full">
                  {/* Prefer mp3 for web streaming */}
                  <source src="/audio/why-we-feel-lonely-preview.mp3" type="audio/mpeg" />
                  <source src="/audio/why-we-feel-lonely-preview.wav" type="audio/wav" />
                  Your browser does not support the audio element.
                </audio>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Free preview</span>
                  <Link to="/listen" className="underline underline-offset-4 hover:text-foreground">
                    More previews →
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-muted p-5">
              <p className="text-sm font-medium">Coming soon</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Full-length bedtime episodes, a growing archive, and founding-listener perks for
                early supporters.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <CardContent className="space-y-2 p-6">
            <p className="font-medium">Cozy late-night tone</p>
            <p className="text-sm text-muted-foreground">
              Calm, unhurried narration designed for bedtime listening—gentle pacing and soft
              landing.
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <CardContent className="space-y-2 p-6">
            <p className="font-medium">Sociology-inspired insight</p>
            <p className="text-sm text-muted-foreground">
              Human behavior explained through stories and everyday examples—curious, comforting,
              and easy to follow.
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <CardContent className="space-y-2 p-6">
            <p className="font-medium">A growing library</p>
            <p className="text-sm text-muted-foreground">
              Short previews now, longer episodes soon. Join the Night List to get new releases and
              early access.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Gentle CTA band */}
      <section className="rounded-3xl border bg-background p-6 sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-lg font-medium">Want new episodes in your inbox?</p>
            <p className="text-sm text-muted-foreground">
              Join the Night List for release notes, early access, and founding-listener perks.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/join">Join the Night List</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/listen">Listen</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

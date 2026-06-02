import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMagicLink } from "@/lib/sendMagicLink";

export default function Home() {
  const [email, setEmail] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [sharing, setSharing] = useState(false);

  const [storyTitle, setStoryTitle] = useState("");
  const [storyCategory, setStoryCategory] = useState("Something I never forgot");
  const [storyBody, setStoryBody] = useState("");
  const [namePreference, setNamePreference] = useState("Keep me anonymous");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [storySubmitting, setStorySubmitting] = useState(false);
  const [storyMessage, setStoryMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function sendLink() {
    setLoading(true);
    setMessage("");

    try {
      const { error } = await sendMagicLink(email);

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage(
        "Magic link sent. Check your email and use the same address you used for membership."
      );
      setEmail("");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMessage("");
  }

  async function shareFeaturedStory() {
    const shareUrl = `${window.location.origin}/#featured-story`;

    const shareData = {
      title: "The Hardest People to Heal From | Stabile USA Night Listener",
      text: "Listen to this free Night Listener story: The Hardest People to Heal From.",
      url: shareUrl,
    };

    setSharing(true);
    setShareMessage("");

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareMessage("Shared.");
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setShareMessage("Link copied.");
    } catch {
      setShareMessage("Unable to share right now.");
    } finally {
      setSharing(false);
    }
  }

  async function submitStory() {
    setStoryMessage("");

    if (!storyBody.trim()) {
      setStoryMessage("Please share your story before submitting.");
      return;
    }

    if (!permissionGranted) {
      setStoryMessage("Please check the permission box before submitting.");
      return;
    }

    setStorySubmitting(true);

    try {
      const { error } = await supabase.from("story_submissions").insert({
        story_title: storyTitle.trim() || null,
        story_category: storyCategory,
        story_body: storyBody.trim(),
        permission_granted: permissionGranted,
        name_preference: namePreference,
        submitter_name: submitterName.trim() || null,
        submitter_email: submitterEmail.trim() || null,
        status: "new",
      });

      if (error) {
        setStoryMessage(error.message);
        return;
      }

      setStoryMessage(
        "Thank you for trusting Stabile USA with your story. Your submission was received."
      );

      setStoryTitle("");
      setStoryCategory("Something I never forgot");
      setStoryBody("");
      setNamePreference("Keep me anonymous");
      setSubmitterName("");
      setSubmitterEmail("");
      setPermissionGranted(false);
    } finally {
      setStorySubmitting(false);
    }
  }

  return (
    <div className="space-y-14">
      <section className="relative overflow-hidden rounded-3xl border bg-background p-6 shadow-sm sm:p-10">
        <div className="pointer-events-none absolute -top-24 right-[-6rem] h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-[-6rem] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />

        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <div className="space-y-6">
            <div className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Night Listener • Human behavior • Story-driven audio
            </div>

            <div className="space-y-5">
              <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Quiet stories about{" "}
                <span className="bg-gradient-to-r from-[#c4a77f] to-[#8f7a60] bg-clip-text text-transparent">
                  the feelings we carry long after the moment has passed
                </span>
                .
              </h1>

              <p className="max-w-xl text-base italic leading-7 text-muted-foreground/90">
                For the conversations you replay, the people you still wonder
                about, and the emotional truths that only make sense later.
              </p>
            </div>

            <p className="text-lg leading-8 text-muted-foreground">
              Start with tonight’s featured story free, then step into a growing
              members-only library of calm, thoughtful audio reflections on love,
              regret, misunderstanding, attachment, and human behavior.
            </p>

            <div className="rounded-2xl border bg-muted/30 p-5">
              <p className="text-sm font-medium">Tonight’s free episode:</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                The Hardest People to Heal From
              </p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                A reflection on the people who truly loved us badly — the ones
                who were both shelter and sorrow.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild className="h-11 px-6">
                <a href="#featured-story">Listen free now</a>
              </Button>

              <Button asChild variant="outline" className="h-11 px-6">
                <Link to="/join">Unlock the full library</Link>
              </Button>

              <Button asChild variant="secondary" className="h-11 px-6">
                <Link to="/listen">Hear more previews</Link>
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              One full story free • Members-only library • Calm storytelling
              voice • Sociology-informed perspective
            </p>
          </div>

          <div className="space-y-4">
            <div
              id="featured-story"
              className="rounded-2xl border bg-background p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Tonight’s featured story
                </p>
                <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  Free full episode
                </span>
              </div>

              <img
                src="/images/the-hardest-people-ep12.png"
                alt="The Hardest People to Heal From"
                className="mb-4 aspect-[3/4] w-full rounded-xl object-contain"
              />

              <p className="text-xl font-medium">
                The Hardest People to Heal From
              </p>

              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                The hardest people to heal from are often the ones who truly
                loved you badly. A quiet reflection on the relationships that
                were both comfort and chaos.
              </p>

              <div className="mt-4 space-y-2">
                <audio controls preload="metadata" className="w-full">
                  <source src="/audio/thehardestpeople.mp3" type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>Your free full story</span>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={shareFeaturedStory}
                      disabled={sharing}
                      className="underline underline-offset-4 hover:text-foreground disabled:opacity-60"
                    >
                      {sharing ? "Sharing..." : "Share this story"}
                    </button>

                    <Link
                      to="/join"
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Continue into the full library →
                    </Link>
                  </div>
                </div>

                {shareMessage && (
                  <p className="text-xs text-muted-foreground">
                    {shareMessage}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border bg-muted p-5">
              <p className="text-sm font-medium">Member login</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Already a member? Sign in with your email to open your full
                Night Listener library.
              </p>

              {sessionEmail ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Signed in as{" "}
                    <span className="font-medium text-foreground">
                      {sessionEmail}
                    </span>
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild className="w-full sm:w-auto">
                      <Link to="/members">Go to Members</Link>
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={signOut}
                    >
                      Sign out
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Welcome in.</p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Enter your email to receive your private access link.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="rounded-xl bg-background"
                    />

                    <Button
                      onClick={sendLink}
                      disabled={!email || loading}
                      className="w-full sm:w-auto"
                    >
                      {loading ? "Sending…" : "Send magic link"}
                    </Button>

                    {message && (
                      <p className="text-xs text-muted-foreground">
                        {message}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <CardContent className="space-y-2 p-6">
            <p className="font-medium">Start with a full story free</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Listen first, feel the tone, and decide whether Night Listener is
              the kind of quiet place you want to return to.
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <CardContent className="space-y-2 p-6">
            <p className="font-medium">Human behavior, softly told</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Each episode explores relationships, private regret, emotional
              patterns, and the thoughts people rarely say out loud.
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <CardContent className="space-y-2 p-6">
            <p className="font-medium">A growing members-only library</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Membership unlocks the full Night Listener collection, with more
              thoughtful stories added as the library grows.
            </p>
          </CardContent>
        </Card>
      </section>

      <section
        id="submit-story"
        className="relative overflow-hidden rounded-3xl border bg-background p-6 shadow-sm sm:p-10"
      >
        <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="space-y-5">
            <div className="w-fit rounded-full border bg-muted px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              True stories • Listener submissions
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Submit a true story you still think about.
              </h2>

              <p className="text-base leading-7 text-muted-foreground">
                It does not have to be shocking. It just has to be real. A
                strange conversation. A moment of intuition. A relationship
                lesson. A season of starting over. A night when something felt
                different.
              </p>
            </div>

            <div className="rounded-2xl border bg-muted/30 p-5">
              <p className="text-sm font-medium">How selected stories may be used</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Stabile USA may adapt selected submissions into future narrated
                Night Listener episodes. Names, locations, and identifying
                details may be changed for privacy, clarity, tone, and length.
              </p>
            </div>

            <p className="text-xs leading-6 text-muted-foreground">
              Please do not include private addresses, phone numbers, medical
              records, financial details, or accusations against clearly
              identifiable people.
            </p>
          </div>

          <div className="rounded-2xl border bg-muted/30 p-5 sm:p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="story-title">
                  Story title
                </label>
                <Input
                  id="story-title"
                  value={storyTitle}
                  onChange={(e) => setStoryTitle(e.target.value)}
                  placeholder="Example: The Phone Call I Still Think About"
                  className="rounded-xl bg-background"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="story-category">
                  What kind of story is this?
                </label>
                <select
                  id="story-category"
                  value={storyCategory}
                  onChange={(e) => setStoryCategory(e.target.value)}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                >
                  <option>Intuition</option>
                  <option>Relationship lesson</option>
                  <option>Strange encounter</option>
                  <option>Starting over</option>
                  <option>Family story</option>
                  <option>Friendship story</option>
                  <option>Work story</option>
                  <option>Something I never forgot</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="story-body">
                  Tell your story
                </label>
                <textarea
                  id="story-body"
                  value={storyBody}
                  onChange={(e) => setStoryBody(e.target.value)}
                  placeholder="Share the story in your own words..."
                  className="min-h-[180px] w-full rounded-xl border bg-background px-3 py-3 text-sm leading-6 outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="name-preference">
                    Name preference
                  </label>
                  <select
                    id="name-preference"
                    value={namePreference}
                    onChange={(e) => setNamePreference(e.target.value)}
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  >
                    <option>Keep me anonymous</option>
                    <option>First name only</option>
                    <option>A fake name is fine</option>
                    <option>Contact me before using any name</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="submitter-name">
                    Your name
                  </label>
                  <Input
                    id="submitter-name"
                    value={submitterName}
                    onChange={(e) => setSubmitterName(e.target.value)}
                    placeholder="Optional"
                    className="rounded-xl bg-background"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="submitter-email">
                  Email address
                </label>
                <Input
                  id="submitter-email"
                  type="email"
                  value={submitterEmail}
                  onChange={(e) => setSubmitterEmail(e.target.value)}
                  placeholder="Optional, but helpful if I need to follow up"
                  className="rounded-xl bg-background"
                />
              </div>

              <label className="flex gap-3 rounded-2xl border bg-background p-4 text-sm leading-6">
                <input
                  type="checkbox"
                  checked={permissionGranted}
                  onChange={(e) => setPermissionGranted(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  Yes, I give Stabile USA permission to adapt, edit, narrate,
                  and publish this story. I understand that names, locations,
                  and identifying details may be changed.
                </span>
              </label>

              <Button
                type="button"
                onClick={submitStory}
                disabled={storySubmitting}
                className="w-full sm:w-auto"
              >
                {storySubmitting ? "Submitting..." : "Submit your story"}
              </Button>

              {storyMessage && (
                <p className="text-sm leading-6 text-muted-foreground">
                  {storyMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-background p-6 sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-lg font-medium">
              Ready for the full Night Listener experience?
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Begin with the free story, explore more previews, unlock the full
              library, or submit a true story of your own.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/join">Unlock membership</Link>
            </Button>

            <Button asChild variant="outline">
              <Link to="/listen">More previews</Link>
            </Button>

            <Button asChild variant="secondary">
              <Link to="/members">Members</Link>
            </Button>

            <Button asChild variant="outline">
              <a href="#submit-story">Submit a story</a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
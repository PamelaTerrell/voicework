import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMagicLink } from "@/lib/sendMagicLink";

const VENTURES = [
  {
    number: "01",
    name: "Night Listener",
    domain: "stabileusa.com",
    href: "#night-listener",
    eyebrow: "Flagship Stabile USA Original",
    statement:
      "Story-driven audio about memory, relationships, emotion, and the things people continue carrying long after a moment has passed.",
    tags: [
      "Original Media",
      "Audio",
      "Human Behavior",
      "Membership",
    ],
  },
  {
    number: "02",
    name: "Crime Recordings",
    domain: "CrimeRecordings.com",
    href: "https://www.crimerecordings.com",
    eyebrow: "Public Records Reimagined",
    statement:
      "A documentary archive transforming police recordings, photographs, documents, interviews, and investigative materials into an organized digital case experience.",
    tags: [
      "Public Records",
      "True Crime",
      "Digital Archives",
      "Media",
    ],
  },
  {
    number: "03",
    name: "Super Cleaning Lady",
    domain: "SuperCleaningLady.com",
    href: "https://www.supercleaninglady.com",
    eyebrow: "Everyday Life Becomes Original IP",
    statement:
      "Cleaning becomes entertainment through original characters, villains, missions, humor, comics, household knowledge, and visual storytelling.",
    tags: [
      "Original IP",
      "Comedy",
      "Lifestyle",
      "Visual Storytelling",
    ],
  },
  {
    number: "04",
    name: "Vino Pairings",
    domain: "VinoPairings.com",
    href: "https://www.vinopairings.com",
    eyebrow: "Wine Without the Intimidation",
    statement:
      "A digital wine and food-pairing experience designed around discovery, useful recommendations, approachable education, and elegant presentation.",
    tags: [
      "Wine",
      "Food",
      "Discovery",
      "Publishing",
    ],
  },
  {
    number: "05",
    name: "Medicare Before You Switch",
    domain: "MedicareBeforeYouSwitch.com",
    href: "https://www.medicarebeforeyouswitch.com",
    eyebrow: "Better Questions Before Big Decisions",
    statement:
      "Independent consumer information designed to help people slow down, understand their options, and ask better questions before changing Medicare coverage.",
    tags: [
      "Consumer Information",
      "Decision Support",
      "Education",
      "Clarity",
    ],
  },
  {
    number: "06",
    name: "Life Stories Now",
    domain: "LifeStoriesNow.com",
    href: "https://www.lifestoriesnow.com",
    eyebrow: "Ordinary Lives Are Worth Preserving",
    statement:
      "A storytelling concept centered on memory, personal history, lived experience, and preserving the stories people do not want the world to lose.",
    tags: [
      "Memory",
      "Human Stories",
      "Legacy",
      "Storytelling",
    ],
  },
  {
    number: "07",
    name: "Pinkerton Williams",
    domain: "PinkertonWilliams.org",
    href: "https://www.pinkertonwilliams.org",
    eyebrow: "Independent Digital Project",
    statement:
      "A purpose-driven digital property developed within the broader Stabile USA ecosystem of independent ideas and long-term projects.",
    tags: [
      "Digital Publishing",
      "Research",
      "Independent Work",
      "Long-Term Stewardship",
    ],
  },
];

const CROSSINGS = [
  {
    from: "PUBLIC RECORDS",
    to: "DIGITAL MEDIA",
    text:
      "Crime Recordings asks what happens when raw government records become an accessible documentary archive.",
  },
  {
    from: "CLEANING",
    to: "ENTERTAINMENT",
    text:
      "Super Cleaning Lady turns ordinary household frustrations into characters, comedy, missions, and original intellectual property.",
  },
  {
    from: "MEMORY",
    to: "STORYTELLING",
    text:
      "Night Listener and Life Stories Now explore the emotional weight of experiences people continue carrying.",
  },
  {
    from: "COMPLEX INFORMATION",
    to: "CLARITY",
    text:
      "Medicare Before You Switch approaches difficult decisions by helping people understand what questions matter first.",
  },
  {
    from: "TECHNOLOGY",
    to: "NEW POSSIBILITIES",
    text:
      "Software, AI, media infrastructure, databases, and modern web systems give unconventional ideas somewhere to become real.",
  },
];

const FOUNDATION = [
  "Web applications",
  "Audio & video",
  "Digital archives",
  "Public records",
  "Membership systems",
  "Databases",
  "Authentication",
  "Cloud media",
  "APIs",
  "AI-assisted production",
  "Search & SEO",
  "Original storytelling",
  "Visual media",
  "Consumer tools",
  "Independent publishing",
];

export default function Home() {
  const [email, setEmail] = useState("");
  const [sessionEmail, setSessionEmail] =
    useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [sharing, setSharing] = useState(false);

  const [storyTitle, setStoryTitle] = useState("");
  const [storyCategory, setStoryCategory] = useState(
    "Something I never forgot",
  );
  const [storyBody, setStoryBody] = useState("");
  const [namePreference, setNamePreference] =
    useState("Keep me anonymous");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] =
    useState("");
  const [permissionGranted, setPermissionGranted] =
    useState(false);
  const [storySubmitting, setStorySubmitting] =
    useState(false);
  const [storyMessage, setStoryMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(
        data.session?.user.email ?? null,
      );
    });

    const { data: sub } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          setSessionEmail(
            session?.user.email ?? null,
          );
        },
      );

    return () =>
      sub.subscription.unsubscribe();
  }, []);

  async function sendLink() {
    setLoading(true);
    setMessage("");

    try {
      const { error } =
        await sendMagicLink(email);

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage(
        "Magic link sent. Check your email and use the same address you used for membership.",
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
    const shareUrl =
      `${window.location.origin}/#featured-story`;

    const shareData = {
      title:
        "A Toast to the End of Us | Stabile USA Night Listener",
      text:
        "Listen to this free Night Listener story: A Toast to the End of Us.",
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

      await navigator.clipboard.writeText(
        shareUrl,
      );

      setShareMessage("Link copied.");
    } catch {
      setShareMessage(
        "Unable to share right now.",
      );
    } finally {
      setSharing(false);
    }
  }

  async function submitStory() {
    setStoryMessage("");

    if (!storyBody.trim()) {
      setStoryMessage(
        "Please share your story before submitting.",
      );
      return;
    }

    if (!permissionGranted) {
      setStoryMessage(
        "Please check the permission box before submitting.",
      );
      return;
    }

    setStorySubmitting(true);

    try {
      const { error } = await supabase
        .from("story_submissions")
        .insert({
          story_title:
            storyTitle.trim() || null,
          story_category: storyCategory,
          story_body: storyBody.trim(),
          permission_granted:
            permissionGranted,
          name_preference:
            namePreference,
          submitter_name:
            submitterName.trim() || null,
          submitter_email:
            submitterEmail.trim() || null,
          status: "new",
        });

      if (error) {
        setStoryMessage(error.message);
        return;
      }

      setStoryMessage(
        "Thank you for trusting Stabile USA with your story. Your submission was received.",
      );

      setStoryTitle("");
      setStoryCategory(
        "Something I never forgot",
      );
      setStoryBody("");
      setNamePreference(
        "Keep me anonymous",
      );
      setSubmitterName("");
      setSubmitterEmail("");
      setPermissionGranted(false);
    } finally {
      setStorySubmitting(false);
    }
  }

  return (
    <main className="overflow-hidden bg-[#02060b] text-white">
      {/* ======================================================
          HERO
      ====================================================== */}
      <section className="relative min-h-[92vh] overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-12rem] top-[-12rem] h-[40rem] w-[40rem] rounded-full bg-[#d8b36d]/10 blur-[150px]" />

          <div className="absolute right-[-10rem] top-[10%] h-[42rem] w-[42rem] rounded-full bg-cyan-600/10 blur-[150px]" />

          <div
            className="absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.065) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.065) 1px, transparent 1px)",
              backgroundSize: "55px 55px",
              maskImage:
                "linear-gradient(to bottom, black, transparent 90%)",
            }}
          />

          <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-b from-transparent to-[#02060b]" />
        </div>

        <div className="relative mx-auto flex min-h-[92vh] max-w-[1600px] flex-col px-6 pb-16 pt-8 sm:px-10 lg:px-16">
          <div className="flex items-center justify-between border-b border-white/10 pb-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#d9b775] sm:text-xs">
              Stabile USA
            </p>

            <p className="hidden text-[10px] uppercase tracking-[0.25em] text-slate-600 sm:block">
              Independent ideas · Built to last
            </p>
          </div>

          <div className="grid flex-1 gap-12 py-16 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:py-20">
            <div>
              <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-[#d7b16c]/25 bg-[#d7b16c]/5 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-[#e4c583]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#e4c583] shadow-[0_0_15px_rgba(228,197,131,.9)]" />
                Independent innovation studio
              </div>

              <h1 className="max-w-[1050px] text-[clamp(3.8rem,9vw,9rem)] font-semibold leading-[0.84] tracking-[-0.07em]">
                We build what
                <span className="mt-2 block bg-gradient-to-r from-[#fff6dc] via-[#d8b36d] to-[#78c8ff] bg-clip-text text-transparent">
                  doesn&apos;t exist yet.
                </span>
              </h1>

              <p className="mt-9 max-w-3xl text-xl font-medium leading-[1.25] tracking-[-0.025em] text-slate-200 sm:text-2xl lg:text-3xl">
                Ideas that cross boundaries.
                Technology that makes them real.
              </p>

              <p className="mt-7 max-w-3xl text-base leading-8 text-slate-400 sm:text-lg">
                Stabile USA creates original
                platforms, media, technology,
                stories, tools, and experiences
                from ideas that do not fit neatly
                inside a single industry.
              </p>

              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.21em] text-slate-600">
                Not one industry. Not one format.
                Not one way of thinking.
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  asChild
                  className="h-12 rounded-full bg-[#d8b36d] px-7 text-[#05080c] hover:bg-[#efd39a]"
                >
                  <a href="#night-listener">
                    Experience Night Listener
                  </a>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="h-12 rounded-full border-white/20 bg-white/[0.03] px-7 text-white hover:bg-white/10 hover:text-white"
                >
                  <a href="#ventures">
                    See what else we&apos;re building
                  </a>
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-[15%] rounded-full bg-[#d8b36d]/10 blur-[100px]" />

              <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#07111c]/80 shadow-[0_50px_150px_rgba(0,0,0,.65)] backdrop-blur-xl">
                <img
                  src="/images/stabileusalogo.png"
                  alt="Stabile USA"
                  className="block h-auto w-full"
                />

                <div className="border-t border-white/10 p-6 sm:p-7">
                  <div className="grid grid-cols-3 divide-x divide-white/10">
                    <div className="pr-4">
                      <p className="text-2xl font-semibold text-[#e5c37e]">
                        7+
                      </p>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-slate-600">
                        Ventures
                      </p>
                    </div>

                    <div className="px-4">
                      <p className="text-2xl font-semibold text-[#e5c37e]">
                        Many
                      </p>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-slate-600">
                        Industries
                      </p>
                    </div>

                    <div className="pl-4">
                      <p className="text-2xl font-semibold text-[#e5c37e]">
                        One
                      </p>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-slate-600">
                        Vision
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6">
            <div className="flex flex-wrap gap-x-7 gap-y-3">
              {FOUNDATION.slice(0, 8).map(
                (item) => (
                  <span
                    key={item}
                    className="text-xs text-slate-600"
                  >
                    {item}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================
          MANIFESTO INTRO
      ====================================================== */}
      <section className="border-b border-white/10 bg-[#050a11]">
        <div className="mx-auto grid max-w-[1500px] gap-12 px-6 py-24 sm:px-10 lg:grid-cols-[.65fr_1.35fr] lg:px-16 lg:py-32">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#d8b36d]">
              Why Stabile USA exists
            </p>
          </div>

          <div>
            <h2 className="max-w-5xl text-4xl font-medium leading-[1.04] tracking-[-0.045em] sm:text-5xl lg:text-7xl">
              The most interesting ideas
              <span className="block text-slate-500">
                rarely belong to one industry.
              </span>
            </h2>

            <p className="mt-8 max-w-3xl text-lg leading-9 text-slate-400">
              They happen when technology meets
              storytelling. When archives become
              experiences. When useful information
              becomes beautiful. When ordinary
              problems become entirely new
              products.
            </p>

            <p className="mt-5 max-w-3xl text-lg leading-9 text-slate-300">
              And sometimes they begin with an
              idea strange enough that no one has
              built it yet.
            </p>
          </div>
        </div>
      </section>

      {/* ======================================================
          NIGHT LISTENER FLAGSHIP
      ====================================================== */}
      <section
        id="night-listener"
        className="relative scroll-mt-20 overflow-hidden border-b border-white/10 bg-[#07101a]"
      >
        <div className="pointer-events-none absolute right-[-8rem] top-[-8rem] h-[36rem] w-[36rem] rounded-full bg-[#b69061]/10 blur-[140px]" />

        <div className="mx-auto max-w-[1500px] px-6 py-24 sm:px-10 lg:px-16 lg:py-32">
          <div className="mb-14 border-b border-white/10 pb-9">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.27em] text-[#d8b36d]">
                  Flagship Stabile USA Original
                </p>

                <h2 className="mt-4 text-5xl font-semibold tracking-[-0.05em] sm:text-6xl lg:text-8xl">
                  Night Listener
                </h2>
              </div>

              <p className="max-w-lg text-base leading-8 text-slate-400">
                Story-driven audio about human
                behavior, private emotions,
                relationships, memory, and the
                moments people continue carrying
                long after they have passed.
              </p>
            </div>
          </div>

          <div className="grid gap-12 lg:grid-cols-[1fr_.9fr] lg:items-start">
            <div>
              <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Human behavior · Quiet reflection ·
                Original audio
              </div>

              <h3 className="mt-8 max-w-4xl text-4xl font-medium leading-[1.04] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
                Some moments end.
                <span className="mt-2 block bg-gradient-to-r from-[#e5c589] to-[#8aa7bf] bg-clip-text text-transparent">
                  The feelings don&apos;t.
                </span>
              </h3>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-400">
                Night Listener explores the
                conversations we replay, the people
                we still wonder about, and the
                emotional truths that sometimes
                only make sense years later.
              </p>

              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-500">
                Start with a complete story free,
                then enter a growing members-only
                library exploring love, regret,
                misunderstanding, contempt,
                attachment, intuition, and human
                behavior.
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <Button
                  asChild
                  className="h-12 rounded-full bg-[#d8b36d] px-7 text-black hover:bg-[#ecd096]"
                >
                  <a href="#featured-story">
                    Listen free now
                  </a>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="h-12 rounded-full border-white/20 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link to="/join">
                    Unlock the full library
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="h-12 rounded-full border-white/20 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link to="/listen">
                    Hear more previews
                  </Link>
                </Button>
              </div>
            </div>

            {/* FEATURED EPISODE */}
            <div
              id="featured-story"
              className="scroll-mt-24 overflow-hidden rounded-[2rem] border border-white/10 bg-[#04090f] shadow-[0_35px_100px_rgba(0,0,0,.4)]"
            >
              <div className="relative">
                <img
                  src="/images/toast-ep14.png"
                  alt="A Toast to the End of Us"
                  className="aspect-[4/3] w-full object-cover object-center"
                />

                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#04090f] to-transparent" />
              </div>

              <div className="relative -mt-12 p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d8b36d]">
                    Tonight&apos;s featured story
                  </p>

                  <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-slate-400">
                    Free full episode
                  </span>
                </div>

                <h3 className="mt-5 text-3xl font-semibold tracking-[-0.03em]">
                  A Toast to the End of Us
                </h3>

                <p className="mt-4 text-sm leading-7 text-slate-400">
                  A quiet story about familiarity,
                  contempt, eye rolls, and the small
                  everyday criticisms that can
                  slowly end a marriage.
                </p>

                <audio
                  controls
                  preload="metadata"
                  className="mt-6 w-full"
                >
                  <source
                    src="/audio/toast-ep14.mp3"
                    type="audio/mpeg"
                  />

                  Your browser does not support
                  the audio element.
                </audio>

                <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-slate-500">
                  <button
                    type="button"
                    onClick={shareFeaturedStory}
                    disabled={sharing}
                    className="underline underline-offset-4 transition hover:text-white disabled:opacity-50"
                  >
                    {sharing
                      ? "Sharing..."
                      : "Share this story"}
                  </button>

                  <Link
                    to="/join"
                    className="underline underline-offset-4 transition hover:text-white"
                  >
                    Continue into the library →
                  </Link>
                </div>

                {shareMessage && (
                  <p className="mt-3 text-xs text-slate-500">
                    {shareMessage}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* MEMBER LOGIN */}
          <div className="mt-10 rounded-[2rem] border border-white/10 bg-black/20 p-6 sm:p-8">
            <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.23em] text-[#d8b36d]">
                  Night Listener member access
                </p>

                <h3 className="mt-3 text-2xl font-semibold">
                  Return to the full library.
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Already a member? Use the email
                  connected to your membership.
                </p>
              </div>

              {sessionEmail ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <p className="text-sm text-slate-400">
                    Signed in as{" "}
                    <span className="text-white">
                      {sessionEmail}
                    </span>
                  </p>

                  <Button asChild>
                    <Link to="/members">
                      Open library
                    </Link>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={signOut}
                    className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  >
                    Sign out
                  </Button>
                </div>
              ) : (
                <div className="w-full max-w-lg">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) =>
                        setEmail(e.target.value)
                      }
                      className="h-11 min-w-0 border-white/10 bg-black/30 text-white"
                    />

                    <Button
                      onClick={sendLink}
                      disabled={!email || loading}
                      className="h-11 shrink-0"
                    >
                      {loading
                        ? "Sending..."
                        : "Send magic link"}
                    </Button>
                  </div>

                  {message && (
                    <p className="mt-3 text-xs text-slate-500">
                      {message}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================
          VENTURES
      ====================================================== */}
      <section
        id="ventures"
        className="scroll-mt-20 border-b border-white/10 bg-[#02060b]"
      >
        <div className="mx-auto max-w-[1500px] px-6 py-24 sm:px-10 lg:px-16 lg:py-32">
          <div className="grid gap-10 border-b border-white/10 pb-12 lg:grid-cols-[.7fr_1.3fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#d8b36d]">
                What else are we building?
              </p>
            </div>

            <div>
              <h2 className="max-w-5xl text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl lg:text-7xl">
                One company.
                <span className="block text-slate-500">
                  Very different ideas.
                </span>
              </h2>

              <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-400">
                Stabile USA does not begin with an
                industry category. We begin with
                the question, the possibility, or
                the thing we wish existed.
              </p>
            </div>
          </div>

          <div className="divide-y divide-white/10">
            {VENTURES.slice(1).map(
              (venture) => (
                <a
                  key={venture.name}
                  href={venture.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group grid gap-7 py-10 transition sm:py-12 lg:grid-cols-[80px_.8fr_1.2fr_auto] lg:items-start"
                >
                  <span className="font-mono text-xs text-slate-700">
                    {venture.number}
                  </span>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d8b36d]">
                      {venture.eyebrow}
                    </p>

                    <h3 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
                      {venture.name}
                    </h3>

                    <p className="mt-1 text-sm text-slate-600">
                      {venture.domain}
                    </p>
                  </div>

                  <div>
                    <p className="max-w-2xl text-base leading-8 text-slate-400">
                      {venture.statement}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {venture.tags.map(
                        (tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-600"
                          >
                            {tag}
                          </span>
                        ),
                      )}
                    </div>
                  </div>

                  <span className="text-xl text-slate-700 transition duration-300 group-hover:translate-x-1 group-hover:text-[#d8b36d]">
                    ↗
                  </span>
                </a>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ======================================================
          CROSS BOUNDARIES
      ====================================================== */}
      <section className="border-b border-white/10 bg-[#07101a]">
        <div className="mx-auto max-w-[1500px] px-6 py-24 sm:px-10 lg:px-16 lg:py-32">
          <div className="mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#d8b36d]">
              We experiment across boundaries
            </p>

            <h2 className="mt-5 max-w-5xl text-4xl font-semibold leading-[1.03] tracking-[-0.045em] sm:text-5xl lg:text-7xl">
              The category is not
              <span className="block text-slate-500">
                the limit.
              </span>
            </h2>
          </div>

          <div className="grid gap-px overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 lg:grid-cols-2">
            {CROSSINGS.map(
              (crossing, index) => (
                <article
                  key={crossing.from}
                  className={`bg-[#050b12] p-7 sm:p-9 ${
                    index === CROSSINGS.length - 1
                      ? "lg:col-span-2"
                      : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-semibold tracking-[0.18em] text-slate-500">
                      {crossing.from}
                    </span>

                    <span className="text-[#d8b36d]">
                      →
                    </span>

                    <span className="text-xs font-semibold tracking-[0.18em] text-white">
                      {crossing.to}
                    </span>
                  </div>

                  <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
                    {crossing.text}
                  </p>
                </article>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ======================================================
          FOUNDATION
      ====================================================== */}
      <section className="border-b border-white/10 bg-[#02060b]">
        <div className="mx-auto grid max-w-[1500px] gap-14 px-6 py-24 sm:px-10 lg:grid-cols-[.8fr_1.2fr] lg:px-16 lg:py-32">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#d8b36d]">
              Built independently
            </p>

            <h2 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl">
              An idea is only interesting
              <span className="block text-slate-500">
                if you can make it real.
              </span>
            </h2>

            <p className="mt-7 max-w-xl text-base leading-8 text-slate-400">
              Behind every Stabile USA project is
              the technical infrastructure needed
              to move from concept to a working,
              public digital product.
            </p>

            <a
              href="https://www.pamelajterrell.com"
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex min-h-12 items-center rounded-full border border-[#d8b36d]/30 px-6 text-sm text-[#e5c584] transition hover:bg-[#d8b36d]/10"
            >
              See how it&apos;s built at
              PamelaJTerrell.com ↗
            </a>
          </div>

          <div className="flex flex-wrap content-start gap-3">
            {FOUNDATION.map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/10 bg-[#07101a] px-4 py-2.5 text-sm text-slate-400"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================
          STORY SUBMISSION
      ====================================================== */}
      <section
        id="submit-story"
        className="scroll-mt-20 border-b border-white/10 bg-[#050a11]"
      >
        <div className="mx-auto max-w-[1500px] px-6 py-24 sm:px-10 lg:px-16 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#d8b36d]">
                Night Listener submissions
              </p>

              <h2 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl">
                Tell us a true story you still
                think about.
              </h2>

              <p className="mt-7 max-w-xl text-base leading-8 text-slate-400">
                It does not have to be shocking.
                It just has to be real. A strange
                conversation. A relationship
                lesson. A moment of intuition. A
                season of starting over. A night
                when something felt different.
              </p>

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <p className="text-sm font-medium text-white">
                  How selected stories may be used
                </p>

                <p className="mt-2 text-sm leading-7 text-slate-500">
                  Stabile USA may adapt selected
                  submissions into future narrated
                  Night Listener episodes. Names,
                  locations, and identifying
                  details may be changed for
                  privacy, clarity, tone, and
                  length.
                </p>
              </div>

              <p className="mt-5 text-xs leading-6 text-slate-600">
                Please do not include private
                addresses, phone numbers, medical
                records, financial details, or
                accusations against clearly
                identifiable people.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[#07101a] p-6 sm:p-8">
              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="story-title"
                    className="text-sm font-medium text-white"
                  >
                    Story title
                  </label>

                  <Input
                    id="story-title"
                    value={storyTitle}
                    onChange={(e) =>
                      setStoryTitle(
                        e.target.value,
                      )
                    }
                    placeholder="Example: The Phone Call I Still Think About"
                    className="mt-2 border-white/10 bg-black/20 text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="story-category"
                    className="text-sm font-medium text-white"
                  >
                    What kind of story is this?
                  </label>

                  <select
                    id="story-category"
                    value={storyCategory}
                    onChange={(e) =>
                      setStoryCategory(
                        e.target.value,
                      )
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#03070d] px-3 text-sm text-white"
                  >
                    <option>Intuition</option>
                    <option>
                      Relationship lesson
                    </option>
                    <option>
                      Strange encounter
                    </option>
                    <option>Starting over</option>
                    <option>Family story</option>
                    <option>
                      Friendship story
                    </option>
                    <option>Work story</option>
                    <option>
                      Something I never forgot
                    </option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="story-body"
                    className="text-sm font-medium text-white"
                  >
                    Tell your story
                  </label>

                  <textarea
                    id="story-body"
                    value={storyBody}
                    onChange={(e) =>
                      setStoryBody(
                        e.target.value,
                      )
                    }
                    placeholder="Share the story in your own words..."
                    className="mt-2 min-h-[190px] w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-slate-700 focus:border-[#d8b36d]/40"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="name-preference"
                      className="text-sm font-medium text-white"
                    >
                      Name preference
                    </label>

                    <select
                      id="name-preference"
                      value={namePreference}
                      onChange={(e) =>
                        setNamePreference(
                          e.target.value,
                        )
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#03070d] px-3 text-sm text-white"
                    >
                      <option>
                        Keep me anonymous
                      </option>
                      <option>
                        First name only
                      </option>
                      <option>
                        A fake name is fine
                      </option>
                      <option>
                        Contact me before using any name
                      </option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="submitter-name"
                      className="text-sm font-medium text-white"
                    >
                      Your name
                    </label>

                    <Input
                      id="submitter-name"
                      value={submitterName}
                      onChange={(e) =>
                        setSubmitterName(
                          e.target.value,
                        )
                      }
                      placeholder="Optional"
                      className="mt-2 border-white/10 bg-black/20 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="submitter-email"
                    className="text-sm font-medium text-white"
                  >
                    Email address
                  </label>

                  <Input
                    id="submitter-email"
                    type="email"
                    value={submitterEmail}
                    onChange={(e) =>
                      setSubmitterEmail(
                        e.target.value,
                      )
                    }
                    placeholder="Optional, but helpful if I need to follow up"
                    className="mt-2 border-white/10 bg-black/20 text-white"
                  />
                </div>

                <label className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-400">
                  <input
                    type="checkbox"
                    checked={
                      permissionGranted
                    }
                    onChange={(e) =>
                      setPermissionGranted(
                        e.target.checked,
                      )
                    }
                    className="mt-1"
                  />

                  <span>
                    Yes, I give Stabile USA
                    permission to adapt, edit,
                    narrate, and publish this story.
                    I understand that names,
                    locations, and identifying
                    details may be changed.
                  </span>
                </label>

                <Button
                  type="button"
                  onClick={submitStory}
                  disabled={storySubmitting}
                  className="h-11 w-full bg-[#d8b36d] text-black hover:bg-[#ecd096] sm:w-auto"
                >
                  {storySubmitting
                    ? "Submitting..."
                    : "Submit your story"}
                </Button>

                {storyMessage && (
                  <p className="text-sm leading-6 text-slate-400">
                    {storyMessage}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================
          FINAL MANIFESTO
      ====================================================== */}
      <section className="relative overflow-hidden bg-[#02060b]">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[50rem] w-[50rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d8b36d]/5 blur-[150px]" />

        <div className="relative mx-auto max-w-[1500px] px-6 py-28 text-center sm:px-10 lg:px-16 lg:py-40">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#d8b36d]">
            The question behind everything
          </p>

          <h2 className="mx-auto mt-7 max-w-6xl text-5xl font-semibold leading-[0.94] tracking-[-0.06em] sm:text-6xl lg:text-8xl">
            What should exist
            <span className="block text-slate-500">
              that doesn&apos;t exist yet?
            </span>
          </h2>

          <p className="mx-auto mt-9 max-w-3xl text-xl leading-9 text-slate-300 sm:text-2xl">
            That&apos;s usually where we start.
          </p>

          <div className="mx-auto mt-14 flex max-w-4xl flex-wrap justify-center gap-x-8 gap-y-4 text-xs uppercase tracking-[0.2em] text-slate-600">
            <span>Independent ideas</span>
            <span>Original media</span>
            <span>Useful technology</span>
            <span>Human stories</span>
            <span>Unbounded possibilities</span>
          </div>

          <div className="mt-20">
            <p className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Stabile USA
            </p>

            <p className="mt-3 text-lg text-[#d8b36d]">
              We build what doesn&apos;t exist yet.
            </p>
          </div>

          <div className="mt-20 border-t border-white/10 pt-8">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-700">
              stabileUSA.com · An independent
              digital innovation company
            </p>

            <a
              href="https://www.pamelajterrell.com"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-xs text-slate-600 underline underline-offset-4 transition hover:text-white"
            >
              Technical development &
              production: PamelaJTerrell.com
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
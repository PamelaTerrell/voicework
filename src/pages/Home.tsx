import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMagicLink } from "@/lib/sendMagicLink";

const PROJECTS = [
  {
    name: "Crime Recordings",
    domain: "CrimeRecordings.com",
    href: "https://www.crimerecordings.com",
    category: "Public Records · True Crime",
    description:
      "A public-record true-crime archive presenting original police recordings, interviews, photographs, documents, and investigative case material.",
    statement: "Public records become an accessible digital archive.",
  },
  {
    name: "Super Cleaning Lady",
    domain: "SuperCleaningLady.com",
    href: "https://www.supercleaninglady.com",
    category: "Original Comic · Entertainment",
    description:
      "An original comic and character-driven entertainment project built around cleaning, household chaos, missions, villains, humor, and visual storytelling.",
    statement: "Everyday life becomes original entertainment.",
  },
  {
    name: "Vino Pairings",
    domain: "VinoPairings.com",
    href: "https://www.vinopairings.com",
    category: "Wine · Food · Discovery",
    description:
      "An approachable wine-and-food discovery platform designed to make pairing, exploring, and learning about wine feel elegant and understandable.",
    statement: "Knowledge becomes discovery.",
  },
  {
    name: "Medicare Before You Switch",
    domain: "MedicareBeforeYouSwitch.com",
    href: "https://www.medicarebeforeyouswitch.com",
    category: "Medicare · Consumer Protection",
    description:
      "Built from years of real insurance-industry experience to help Medicare recipients ask better questions and understand what may change before switching coverage.",
    statement: "Experience becomes protection.",
  },
  {
    name: "Life Stories Now",
    domain: "LifeStoriesNow.com",
    href: "https://www.lifestoriesnow.com",
    category: "Memory · Storytelling",
    description:
      "A human-story project centered on preserving memories, personal histories, lived experiences, and the stories people do not want to lose.",
    statement: "Ordinary lives become lasting stories.",
  },
  {
    name: "Pinkerton-Williams DAV",
    domain: "PinkertonWilliams.org",
    href: "https://www.pinkertonwilliams.org",
    category: "Mission-Driven Web Project",
    description:
      "A digital home created for the Pinkerton-Williams Chapter of the Disabled American Veterans, supporting its members, mission, and community.",
    statement: "Technology supports a real-world mission.",
  },
];

const EXPERIENCE = [
  "Original media",
  "Digital publishing",
  "Public-record research",
  "Web applications",
  "Audio & video",
  "Digital archives",
  "Membership systems",
  "Consumer information",
  "Insurance experience",
  "Storytelling",
  "Comic & visual media",
  "Cloud infrastructure",
  "Databases",
  "Authentication",
  "APIs",
  "SEO & analytics",
  "AI-assisted production",
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
  const [namePreference, setNamePreference] = useState(
    "Keep me anonymous",
  );
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [permissionGranted, setPermissionGranted] =
    useState(false);
  const [storySubmitting, setStorySubmitting] =
    useState(false);
  const [storyMessage, setStoryMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
    });

    const { data: sub } =
      supabase.auth.onAuthStateChange((_event, session) => {
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
    const shareUrl = `${window.location.origin}/#featured-story`;

    const shareData = {
      title:
        "A Toast to the End of Us | Stabile USA Night Listener",
      text:
        "Discover this Night Listener story: A Toast to the End of Us.",
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
          story_title: storyTitle.trim() || null,
          story_category: storyCategory,
          story_body: storyBody.trim(),
          permission_granted: permissionGranted,
          name_preference: namePreference,
          submitter_name: submitterName.trim() || null,
          submitter_email: submitterEmail.trim() || null,
        });

      if (error) {
        setStoryMessage(error.message);
        return;
      }

      setStoryMessage(
        "Thank you for trusting Stabile USA with your story. Your submission was received.",
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
    <main className="w-full overflow-x-hidden bg-[#02060b] text-white">
      {/* ======================================================
          FULL-WIDTH CINEMATIC HERO
      ====================================================== */}

      <section className="relative w-full overflow-hidden bg-[#02060b]">
        {/* BACKGROUND FILL */}
        <div className="absolute inset-0 overflow-hidden">
          <picture>
            <source
              media="(max-width: 767px)"
              srcSet="/images/stabileusa-hero-mobile.png"
            />

            <img
              src="/images/stabileusa-hero.png"
              alt=""
              aria-hidden="true"
              className="
                absolute
                inset-0
                h-full
                w-full
                scale-110
                object-cover
                object-center
                opacity-45
                blur-2xl
              "
            />
          </picture>

          <div className="absolute inset-0 bg-[#02060b]/30" />
        </div>

        {/* MAIN ARTWORK */}
        <div
          className="
            relative
            z-10
            flex
            w-full
            items-center
            justify-center
            min-h-[100svh]
          "
        >
          <picture className="block h-full w-full">
            <source
              media="(max-width: 767px)"
              srcSet="/images/stabileusa-hero-mobile.png"
            />

            <img
              src="/images/stabileusa-hero.png"
              alt="Stabile USA digital media brand — creative ideas built to last, advancing the human experience, and stories that inspire with solutions that endure"
              className="
                block
                h-[100svh]
                w-full
                object-contain
                object-center
              "
            />
          </picture>
        </div>

        {/* CINEMATIC FADES */}
        <div
          className="
            pointer-events-none
            absolute
            inset-x-0
            bottom-0
            z-20
            h-32
            bg-gradient-to-t
            from-[#02060b]
            via-[#02060b]/40
            to-transparent
            sm:h-36
            lg:h-40
          "
        />

        <div
          className="
            pointer-events-none
            absolute
            inset-x-0
            top-0
            z-20
            h-24
            bg-gradient-to-b
            from-[#02060b]/50
            to-transparent
            sm:h-28
          "
        />

        <div className="pointer-events-none absolute inset-0 z-20 hidden bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.24)_100%)] xl:block" />

        {/* TOP BRAND STRIP */}
        <div
          className="
            absolute
            inset-x-0
            top-0
            z-30
            flex
            w-full
            items-center
            justify-between
            px-4
            pt-4
            sm:px-7
            sm:pt-6
            lg:px-10
            xl:px-16
            2xl:px-20
          "
        >
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/25 px-3 py-2 backdrop-blur-md sm:px-4">
            <img
              src="/images/stabile-s-logo.png"
              alt=""
              aria-hidden="true"
              className="h-7 w-7 rounded-full object-cover shadow-[0_0_22px_rgba(215,175,101,.22)] sm:h-8 sm:w-8"
            />

            <span className="hidden text-[9px] font-semibold uppercase tracking-[0.27em] text-white/80 sm:inline">
              Stabile USA
            </span>
          </div>

          <a
            href="https://www.pamelajterrell.com"
            target="_blank"
            rel="noreferrer"
            className="
              rounded-full
              border
              border-white/15
              bg-black/30
              px-3.5
              py-2
              text-[8px]
              font-medium
              uppercase
              tracking-[0.14em]
              text-white/70
              backdrop-blur-md
              transition
              hover:border-[#d7af65]/50
              hover:bg-black/55
              hover:text-white
              sm:px-4
              sm:text-[9px]
              sm:tracking-[0.17em]
              lg:text-[10px]
            "
          >
            Pamela J. Terrell ↗
          </a>
        </div>

        {/* HERO BUTTONS */}
        <div
          className="
            absolute
            inset-x-0
            bottom-0
            z-30
            px-4
            pb-5
            sm:px-7
            sm:pb-6
            lg:px-10
            lg:pb-8
            xl:px-16
          "
        >
          <div className="mx-auto flex w-full max-w-[1800px] flex-row justify-center gap-2 sm:gap-3">
            <a
              href="#night-listener"
              className="
                inline-flex
                min-h-10
                flex-1
                items-center
                justify-center
                rounded-full
                border
                border-[#d7af65]/55
                bg-black/60
                px-3
                text-center
                text-[8px]
                font-semibold
                uppercase
                tracking-[0.10em]
                text-[#f0d493]
                shadow-lg
                backdrop-blur-md
                transition
                hover:border-[#e7ca90]/80
                hover:bg-black/75
                sm:min-h-11
                sm:flex-none
                sm:px-6
                sm:text-[10px]
                sm:tracking-[0.14em]
              "
            >
              Experience Night Listener
            </a>

            <a
              href="#projects"
              className="
                inline-flex
                min-h-10
                flex-1
                items-center
                justify-center
                rounded-full
                border
                border-white/20
                bg-black/50
                px-3
                text-center
                text-[8px]
                font-semibold
                uppercase
                tracking-[0.10em]
                text-white
                backdrop-blur-md
                transition
                hover:border-white/35
                hover:bg-black/70
                sm:min-h-11
                sm:flex-none
                sm:px-6
                sm:text-[10px]
                sm:tracking-[0.14em]
              "
            >
              Explore Stabile USA
            </a>
          </div>
        </div>
      </section>

      {/* ======================================================
          BRAND INTRO
      ====================================================== */}

      <section className="w-full border-b border-white/10 bg-[#02060b]">
        <div
          className="
            mx-auto
            grid
            w-full
            max-w-[1900px]
            gap-10
            px-5
            py-16
            sm:px-8
            sm:py-20
            lg:grid-cols-[0.45fr_1.55fr]
            lg:px-12
            lg:py-24
            xl:px-16
            2xl:px-20
          "
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d7af65]">
              Stabile USA
            </p>
          </div>

          <div>
            <h1 className="max-w-5xl text-3xl font-medium leading-[1.08] tracking-[-0.035em] sm:text-4xl lg:text-5xl">
              Ideas with purpose.
              <span className="mt-2 block text-slate-500">
                Built with experience.
              </span>
            </h1>

            <p className="mt-7 max-w-4xl text-base leading-8 text-slate-400 sm:text-lg">
              Stabile USA is an independent digital brand
              creating original media, technology-driven
              platforms, useful information, entertainment,
              storytelling, and mission-driven web projects
              across very different areas.
            </p>

            <p className="mt-5 max-w-4xl text-base leading-8 text-slate-500">
              The common foundation is real-world experience,
              independent thinking, curiosity, and the ability
              to turn an idea into something people can
              actually use, hear, explore, learn from, or enjoy.
            </p>
          </div>
        </div>
      </section>

      {/* ======================================================
          NIGHT LISTENER
      ====================================================== */}

      <section
        id="night-listener"
        className="relative w-full scroll-mt-20 overflow-hidden border-b border-white/10 bg-[#071019]"
      >
        <div className="pointer-events-none absolute right-[-12rem] top-[-12rem] h-[42rem] w-[42rem] rounded-full bg-[#c59a59]/10 blur-[150px]" />

        <div
          className="
            relative
            mx-auto
            w-full
            max-w-[1900px]
            px-5
            py-20
            sm:px-8
            sm:py-24
            lg:px-12
            xl:px-16
            2xl:px-20
          "
        >
          <div className="mb-12 flex flex-col gap-6 border-b border-white/10 pb-9 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.27em] text-[#d7af65]">
                Flagship Stabile USA Original
              </p>

              <h2 className="mt-4 text-4xl font-medium tracking-[-0.04em] sm:text-5xl lg:text-6xl">
                Night Listener
              </h2>
            </div>

            <p className="max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
              Original story-driven audio about memory,
              relationships, private emotions, human behavior,
              and the moments people continue carrying long
              after they have passed.
            </p>
          </div>

          <div className="grid gap-10 xl:grid-cols-[0.7fr_1.3fr] xl:items-center">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-600">
                Quiet · Intimate · Human
              </p>

              <h3 className="mt-6 max-w-2xl text-3xl font-medium leading-[1.06] tracking-[-0.035em] sm:text-4xl lg:text-5xl">
                Some moments end.
                <span className="mt-2 block text-[#d0ad72]">
                  The feelings don&apos;t.
                </span>
              </h3>

              <p className="mt-7 max-w-2xl text-base leading-8 text-slate-400">
                Night Listener explores the people we still
                wonder about, the conversations we replay,
                and the emotional truths that sometimes only
                make sense later.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  asChild
                  className="h-11 rounded-full bg-[#d6ae65] px-6 text-black hover:bg-[#e8ca91]"
                >
                  <Link to="/listen">Listen free</Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="h-11 rounded-full border-white/20 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link to="/join">
                    Unlock the full library
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="h-11 rounded-full border-white/20 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link to="/listen">
                    More previews
                  </Link>
                </Button>
              </div>
            </div>

            <div
              id="featured-story"
              className="scroll-mt-24 overflow-hidden rounded-[2rem] border border-white/10 bg-[#03070c] shadow-[0_40px_120px_rgba(0,0,0,.45)]"
            >
              <div className="grid md:grid-cols-[0.82fr_1.18fr]">
                <img
                  src="/images/toast-ep14.png"
                  alt="A Toast to the End of Us"
                  className="h-full min-h-[340px] w-full object-cover"
                />

                <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10 xl:p-12">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d6ae65]">
                    Members-only story
                  </p>

                  <h3 className="mt-4 text-2xl font-medium tracking-[-0.03em] lg:text-3xl">
                    A Toast to the End of Us
                  </h3>

                  <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
                    A quiet story about familiarity, contempt,
                    eye rolls, and the small everyday
                    criticisms that can slowly end a marriage.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-5 text-xs text-slate-500">
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
                      Unlock this story →
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
          </div>

          {/* MEMBER ACCESS */}
          <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-black/20 p-6 sm:p-7 lg:p-8">
            <div className="grid gap-6 xl:grid-cols-[1fr_auto] xl:items-center">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#d6ae65]">
                  Member access
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  Already a member? Sign in using your
                  membership email.
                </p>
              </div>

              {sessionEmail ? (
                <div className="flex flex-wrap items-center gap-3">
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
                <div className="w-full max-w-2xl">
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
          PROJECTS
      ====================================================== */}

      <section
        id="projects"
        className="w-full scroll-mt-20 border-b border-white/10 bg-[#02060b]"
      >
        <div
          className="
            mx-auto
            w-full
            max-w-[1900px]
            px-5
            py-20
            sm:px-8
            sm:py-24
            lg:px-12
            xl:px-16
            2xl:px-20
          "
        >
          <div className="mb-14 grid gap-10 border-b border-white/10 pb-11 lg:grid-cols-[0.45fr_1.55fr]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d7af65]">
                Across Stabile USA
              </p>
            </div>

            <div>
              <h2 className="max-w-5xl text-3xl font-medium leading-[1.08] tracking-[-0.035em] sm:text-4xl lg:text-5xl">
                Different experience.
                <span className="mt-2 block text-slate-500">
                  Different ideas. One foundation.
                </span>
              </h2>

              <p className="mt-6 max-w-4xl text-base leading-8 text-slate-400">
                Stabile USA projects come from very different
                places — professional experience, curiosity,
                creative ideas, community needs, personal
                interests, technology, research, and stories
                worth preserving.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {PROJECTS.map((project) => (
              <a
                key={project.domain}
                href={project.href}
                target="_blank"
                rel="noreferrer"
                className="
                  group
                  relative
                  min-h-[360px]
                  overflow-hidden
                  rounded-[1.6rem]
                  border
                  border-white/10
                  bg-[#07101a]
                  p-6
                  transition
                  duration-300
                  hover:-translate-y-1
                  hover:border-[#d7af65]/40
                "
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#d7af65]/[0.05] to-transparent opacity-0 transition group-hover:opacity-100" />

                <div className="relative flex h-full flex-col">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#d7af65]">
                    {project.category}
                  </p>

                  <h3 className="mt-5 text-xl font-medium tracking-[-0.03em] xl:text-2xl">
                    {project.name}
                  </h3>

                  <p className="mt-1 break-words text-xs text-slate-600">
                    {project.domain}
                  </p>

                  <p className="mt-6 text-sm leading-7 text-slate-400">
                    {project.description}
                  </p>

                  <div className="mt-auto pt-9">
                    <div className="border-t border-white/10 pt-5">
                      <p className="text-sm leading-6 text-slate-300">
                        {project.statement}
                      </p>

                      <p className="mt-5 text-[10px] uppercase tracking-[0.17em] text-slate-600 transition group-hover:text-[#d7af65]">
                        Visit project ↗
                      </p>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================
          EXPERIENCE
      ====================================================== */}

      <section className="w-full border-b border-white/10 bg-[#050a11]">
        <div
          className="
            mx-auto
            grid
            w-full
            max-w-[1900px]
            gap-12
            px-5
            py-20
            sm:px-8
            sm:py-24
            lg:grid-cols-[0.55fr_1.45fr]
            lg:px-12
            xl:px-16
            2xl:px-20
          "
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d7af65]">
              Experience brought forward
            </p>

            <h2 className="mt-5 max-w-xl text-3xl font-medium leading-[1.08] tracking-[-0.035em] sm:text-4xl">
              Knowledge from one world can become
              useful in another.
            </h2>

            <p className="mt-6 max-w-xl text-base leading-8 text-slate-400">
              Professional experience, research, software
              development, media production, storytelling,
              design, and emerging technology all inform the
              work.
            </p>
          </div>

          <div className="flex content-start flex-wrap gap-3">
            {EXPERIENCE.map((item) => (
              <span
                key={item}
                className="
                  rounded-full
                  border
                  border-white/10
                  bg-[#07101a]
                  px-4
                  py-2.5
                  text-sm
                  text-slate-400
                  lg:px-5
                  lg:py-3
                "
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="w-full border-t border-white/10">
          <div
            className="
              mx-auto
              flex
              w-full
              max-w-[1900px]
              flex-col
              gap-5
              px-5
              py-10
              sm:flex-row
              sm:items-center
              sm:justify-between
              sm:px-8
              lg:px-12
              xl:px-16
              2xl:px-20
            "
          >
            <div>
              <p className="text-sm text-slate-500">
                Creative direction, development,
                research & production
              </p>

              <p className="mt-1 text-lg font-medium">
                Pamela J. Terrell
              </p>
            </div>

            <a
              href="https://www.pamelajterrell.com"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[#d7af65] underline underline-offset-4 transition hover:text-[#efd296]"
            >
              PamelaJTerrell.com ↗
            </a>
          </div>
        </div>
      </section>

      {/* ======================================================
          STORY SUBMISSION
      ====================================================== */}

      <section
        id="submit-story"
        className="w-full scroll-mt-20 border-b border-white/10 bg-[#02060b]"
      >
        <div
          className="
            mx-auto
            grid
            w-full
            max-w-[1900px]
            gap-12
            px-5
            py-20
            sm:px-8
            sm:py-24
            lg:grid-cols-[0.65fr_1.35fr]
            lg:px-12
            xl:px-16
            2xl:px-20
          "
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d7af65]">
              Night Listener submissions
            </p>

            <h2 className="mt-5 max-w-xl text-3xl font-medium leading-[1.08] tracking-[-0.035em] sm:text-4xl">
              Tell us a true story you still think about.
            </h2>

            <p className="mt-6 max-w-xl text-base leading-8 text-slate-400">
              It does not need to be shocking. It just
              needs to be real — a conversation, a strange
              encounter, a relationship lesson, intuition,
              starting over, or something you simply never
              forgot.
            </p>

            <div className="mt-8 max-w-xl rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <p className="text-sm font-medium">
                How selected stories may be used
              </p>

              <p className="mt-2 text-sm leading-7 text-slate-500">
                Stabile USA may adapt selected submissions
                into future narrated Night Listener
                episodes. Names, locations, and identifying
                details may be changed for privacy,
                clarity, tone, and length.
              </p>
            </div>

            <p className="mt-5 max-w-xl text-xs leading-6 text-slate-600">
              Please do not include private addresses,
              phone numbers, medical records, financial
              details, or accusations against clearly
              identifiable people.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#07101a] p-5 sm:p-7 lg:p-9 xl:p-10">
            <div className="space-y-5">
              <div>
                <label
                  htmlFor="story-title"
                  className="text-sm font-medium"
                >
                  Story title
                </label>

                <Input
                  id="story-title"
                  value={storyTitle}
                  onChange={(e) =>
                    setStoryTitle(e.target.value)
                  }
                  placeholder="Example: The Phone Call I Still Think About"
                  className="mt-2 border-white/10 bg-black/20 text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="story-category"
                  className="text-sm font-medium"
                >
                  What kind of story is this?
                </label>

                <select
                  id="story-category"
                  value={storyCategory}
                  onChange={(e) =>
                    setStoryCategory(e.target.value)
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#03070d] px-3 text-sm text-white"
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

              <div>
                <label
                  htmlFor="story-body"
                  className="text-sm font-medium"
                >
                  Tell your story
                </label>

                <textarea
                  id="story-body"
                  value={storyBody}
                  onChange={(e) =>
                    setStoryBody(e.target.value)
                  }
                  placeholder="Share the story in your own words..."
                  className="mt-2 min-h-[210px] w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-slate-700 focus:border-[#d7af65]/40"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="name-preference"
                    className="text-sm font-medium"
                  >
                    Name preference
                  </label>

                  <select
                    id="name-preference"
                    value={namePreference}
                    onChange={(e) =>
                      setNamePreference(e.target.value)
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#03070d] px-3 text-sm text-white"
                  >
                    <option>Keep me anonymous</option>
                    <option>First name only</option>
                    <option>A fake name is fine</option>
                    <option>
                      Contact me before using any name
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="submitter-name"
                    className="text-sm font-medium"
                  >
                    Your name
                  </label>

                  <Input
                    id="submitter-name"
                    value={submitterName}
                    onChange={(e) =>
                      setSubmitterName(e.target.value)
                    }
                    placeholder="Optional"
                    className="mt-2 border-white/10 bg-black/20 text-white"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="submitter-email"
                  className="text-sm font-medium"
                >
                  Email address
                </label>

                <Input
                  id="submitter-email"
                  type="email"
                  value={submitterEmail}
                  onChange={(e) =>
                    setSubmitterEmail(e.target.value)
                  }
                  placeholder="Optional, but helpful if I need to follow up"
                  className="mt-2 border-white/10 bg-black/20 text-white"
                />
              </div>

              <label className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-400">
                <input
                  type="checkbox"
                  checked={permissionGranted}
                  onChange={(e) =>
                    setPermissionGranted(e.target.checked)
                  }
                  className="mt-1"
                />

                <span>
                  Yes, I give Stabile USA permission to
                  adapt, edit, narrate, and publish this
                  story. I understand that names,
                  locations, and identifying details may
                  be changed.
                </span>
              </label>

              <Button
                type="button"
                onClick={submitStory}
                disabled={storySubmitting}
                className="h-11 w-full bg-[#d7af65] text-black hover:bg-[#e8cb91] sm:w-auto"
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
      </section>

      {/* ======================================================
          FINAL BRAND MOMENT
      ====================================================== */}

      <section className="relative w-full overflow-hidden bg-[#03070d]">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[50rem] w-[50rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d7af65]/5 blur-[160px]" />

        <div
          className="
            relative
            mx-auto
            w-full
            max-w-[1900px]
            px-5
            py-24
            text-center
            sm:px-8
            sm:py-28
            lg:px-12
            lg:py-32
            xl:px-16
            2xl:px-20
          "
        >
          <img
            src="/images/stabile-s-logo.png"
            alt="Stabile USA"
            className="mx-auto w-[105px] drop-shadow-[0_0_30px_rgba(215,175,101,.2)] sm:w-[120px]"
          />

          <p className="mt-9 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d7af65]">
            Stabile USA
          </p>

          <h2 className="mx-auto mt-6 max-w-4xl text-3xl font-medium leading-[1.08] tracking-[-0.035em] sm:text-4xl lg:text-5xl">
            Independent ideas.
            <span className="mt-2 block text-slate-500">
              Built with purpose.
            </span>
          </h2>

          <p className="mx-auto mt-7 max-w-3xl text-base leading-8 text-slate-400">
            Experience, creativity, technology,
            information, storytelling, and curiosity —
            brought together wherever they can do something
            worthwhile.
          </p>

          <div className="mx-auto mt-16 max-w-[1700px] border-t border-white/10 pt-7">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-700">
              stabileUSA.com · Independent digital media brand
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

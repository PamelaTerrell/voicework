import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMagicLink } from "@/lib/sendMagicLink";

import { STORY_CATEGORIES, STORY_LIMITS, STORY_NAME_PREFERENCES } from "@/lib/storySubmissionFields";

const USE_STORY_API = import.meta.env.VITE_STORY_SUBMISSION_API === "true";
const STORY_UNAVAILABLE = "Your submission could not be sent right now. Please try again.";

const PROJECTS = [
  { name: "Crime Recordings", href: "https://www.crimerecordings.com", description: "A public-record archive of original investigative audio, images, and documents." },
  { name: "Super Cleaning Lady", href: "https://www.supercleaninglady.com", description: "Original characters and comedy inspired by everyday household chaos." },
  { name: "Vino Pairings", href: "https://www.vinopairings.com", description: "Approachable food-and-wine discovery." },
  { name: "Medicare Before You Switch", href: "https://www.medicarebeforeyouswitch.com", description: "Consumer-focused educational resources for making informed Medicare decisions." },
  { name: "Pinkerton-Williams DAV", href: "https://www.pinkertonwilliams.org", description: "A mission-driven website supporting a local veterans chapter." },
];

export default function Home() {
  const [email, setEmail] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [storyTitle, setStoryTitle] = useState("");
  const [storyCategory, setStoryCategory] = useState("Something I never forgot");
  const [storyBody, setStoryBody] = useState("");
  const [namePreference, setNamePreference] = useState("Keep me anonymous");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [permissionGranted, setPermissionGranted] = useState(false);
  const pendingStory = useRef<{ payload: string; id: string } | null>(null);
  const [storySubmitting, setStorySubmitting] = useState(false);
  const [storyMessage, setStoryMessage] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSessionEmail(data.session?.user.email ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setSessionEmail(session?.user.email ?? null);
    });
    return () => { mounted = false; subscription.subscription.unsubscribe(); };
  }, []);

  async function sendLink() {
    setLoading(true);
    setMessage("");
    try {
      const { error } = await sendMagicLink(email);
      if (error) { setMessage(error.message); return; }
      setMessage("Magic link sent. Check your email and use the same address you used for membership.");
      setEmail("");
    } catch {
      setMessage("We couldn't send the link right now. Please try again.");
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
    setSharing(true);
    setShareMessage("");
    try {
      if (navigator.share) {
        await navigator.share({
          title: "A Toast to the End of Us | Stabile USA Night Listener",
          text: "Discover this Night Listener story: A Toast to the End of Us.",
          url: shareUrl,
        });
        setShareMessage("Shared.");
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareMessage("Link copied.");
      }
    } catch {
      setShareMessage("Unable to share right now.");
    } finally {
      setSharing(false);
    }
  }

  async function submitStory(website: string) {
    setStoryMessage("");
    if (!storyBody.trim()) {
      setStoryMessage("Please share your story before submitting.");
      return;
    }
    if (!permissionGranted) {
      setStoryMessage("Please review and check the publishing permission before submitting.");
      return;
    }
    setStorySubmitting(true);
    try {
      const story = {
        story_title: storyTitle.trim() || null,
        story_category: storyCategory,
        story_body: storyBody.trim(),
        permission_granted: permissionGranted,
        name_preference: namePreference,
        submitter_name: submitterName.trim() || null,
        submitter_email: submitterEmail.trim() || null,
      };
      if (USE_STORY_API) {
        const payload = JSON.stringify({ ...story, website });
        if (pendingStory.current?.payload !== payload) {
          pendingStory.current = { payload, id: crypto.randomUUID() };
        }
        const response = await fetch("/api/story-submission", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": pendingStory.current.id },
          body: payload,
        });
        if (!response.ok) {
          const result: { message?: unknown } | null = await response.json().catch(() => null);
          setStoryMessage(typeof result?.message === "string" ? result.message : STORY_UNAVAILABLE);
          return;
        }
        if (response.status !== 201) {
          setStoryMessage(STORY_UNAVAILABLE);
          return;
        }
      } else {
        const { error } = await supabase.from("story_submissions").insert(story);
        if (error) { setStoryMessage(STORY_UNAVAILABLE); return; }
      }
      setStoryMessage("Thank you for trusting Stabile USA with your story. Your submission was received.");
      pendingStory.current = null;
      setStoryTitle("");
      setStoryCategory("Something I never forgot");
      setStoryBody("");
      setNamePreference("Keep me anonymous");
      setSubmitterName("");
      setSubmitterEmail("");
      setPermissionGranted(false);
    } catch {
      setStoryMessage(STORY_UNAVAILABLE);
    } finally {
      setStorySubmitting(false);
    }
  }

  return (
    <div className="w-full overflow-x-hidden bg-[#030b13] text-white">
      {/* HERO: pre-rendered window-view artwork includes the title and tagline.
          Do not overlay another large heading on top of the artwork. */}
      <section aria-labelledby="home-hero-heading" className="relative border-b border-white/10 bg-[#041522]">
        <h1 id="home-hero-heading" className="sr-only">Stabile USA</h1>
        <img
          src="/images/human-experience-city-hero.webp"
          srcSet="/images/human-experience-city-hero-small.webp 836w, /images/human-experience-city-hero.webp 1672w"
          sizes="100vw"
          width={1672}
          height={941}
          alt="Stabile USA presents The Human Experience. Every life is a story. Every story reveals something about the world. A nighttime city apartment building reveals everyday lives through glowing windows."
          className="block h-auto w-full"
          fetchPriority="high"
        />
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 pb-9 pt-6 text-center sm:pb-11">
          <p className="max-w-3xl text-xl font-medium leading-8 text-white sm:text-2xl">
            Every life holds a story. Every story deserves a voice.
          </p>
          <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            Stabile USA is an independent storytelling, audio production, and digital media company.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild className="rounded-full bg-[#d7af65] text-black hover:bg-[#e8ca91]"><Link to="/listen">Listen to Stories</Link></Button>
            <Button asChild variant="outline" className="rounded-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"><a href="#submit-story">Share Your Experience</a></Button>
            <Button asChild variant="outline" className="rounded-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"><Link to="/voice">Voice &amp; Production</Link></Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <h2 className="max-w-4xl text-3xl font-medium leading-tight sm:text-5xl">The Human Experience</h2>
        <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">
          The Human Experience is the editorial heart of Stabile USA. Through original audio and stories inspired by real lives, we invite people to listen, reflect, and recognize something of themselves in others.
        </p>
      </section>

      {/* NIGHT LISTENER: public listening and paid membership routes remain in place. */}
      <section id="night-listener" className="scroll-mt-24 border-b border-white/10 bg-[#050e19]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d7af65]">Stabile USA original audio</p>
          <h2 className="mt-4 text-4xl font-medium tracking-tight sm:text-5xl">Night Listener</h2>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">Some moments end. The feelings don't. Listen to intimate, narrated stories about relationships, memory, private emotions, and the things people carry long after an experience has passed.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild className="rounded-full bg-[#d7af65] px-6 text-black hover:bg-[#e8ca91]"><Link to="/listen">Listen free</Link></Button>
            <Button asChild variant="outline" className="rounded-full border-white/25 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"><Link to="/join">Explore membership</Link></Button>
          </div>
          <div id="featured-story" className="mt-10 grid overflow-hidden rounded-3xl border border-white/10 bg-[#0b1724] md:grid-cols-[0.65fr_1fr]">
            <img src="/images/toast-ep14.png" alt="A Toast to the End of Us" className="h-full min-h-60 w-full object-cover" loading="lazy" />
            <div className="flex flex-col justify-center p-7 sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d7af65]">Featured members-only story</p>
              <h3 className="mt-4 text-2xl font-medium sm:text-3xl">A Toast to the End of Us</h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">A quiet story about familiarity, contempt, eye rolls, and the small everyday criticisms that can slowly end a marriage.</p>
              <div className="mt-6 flex flex-wrap items-center gap-6 text-sm">
                <button type="button" onClick={shareFeaturedStory} disabled={sharing} className="text-[#8bd5be] underline underline-offset-4 disabled:opacity-50">{sharing ? "Sharing..." : "Share this story"}</button>
                <Link to="/join" className="text-[#d7af65] underline underline-offset-4">Unlock this story →</Link>
              </div>
              {shareMessage && <p role="status" className="mt-3 text-sm text-slate-300">{shareMessage}</p>}
            </div>
          </div>
          <div className="mt-7 rounded-3xl border border-white/10 bg-[#0a1a28] p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d7af65]">Existing member access</p>
            <p className="mt-2 text-sm text-slate-300">Already a member? Sign in with the email used for your membership.</p>
            {sessionEmail ? (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="text-sm text-slate-300">Signed in as {sessionEmail}</span>
                <Button asChild><Link to="/members">Open library</Link></Button>
                <Button type="button" variant="outline" onClick={signOut} className="border-white/30 bg-transparent text-white hover:bg-white/10">Sign out</Button>
              </div>
            ) : (
              <div className="mt-5 flex max-w-xl flex-col gap-3 sm:flex-row">
                <Input type="email" autoComplete="email" aria-label="Membership email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 border-white/20 bg-black/25 text-white" />
                <Button type="button" onClick={sendLink} disabled={!email.trim() || loading} className="h-11 shrink-0">{loading ? "Sending..." : "Send magic link"}</Button>
              </div>
            )}
            {message && <p role="status" className="mt-3 text-sm text-slate-300">{message}</p>}
          </div>
        </div>
      </section>

      <section id="submit-story" className="scroll-mt-48 sm:scroll-mt-36 border-b border-white/10 bg-[#030b13]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8bd5be]">Share your experience</p>
            <h2 className="mt-4 text-3xl font-medium leading-tight sm:text-4xl">What would you like the world to understand?</h2>
            <p className="mt-5 text-base leading-8 text-slate-300">Share a true story, a turning point, a misunderstanding, or something you still think about. Ordinary experiences can reveal extraordinary things about the world.</p>
            <p className="mt-6 text-sm leading-7 text-slate-400">Stabile USA receives submissions for editorial review. Selected experiences may inspire an adapted, narrated story. Submitting does not publish your story or guarantee that it will be selected.</p>
            <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-slate-300">
              <strong className="text-white">Protecting people's stories</strong>
              <p className="mt-2">Please avoid addresses, phone numbers, private medical or financial details, and allegations about identifiable people. We may change names or identifying details if a story is selected for publication.</p>
            </div>
          </div>
          <form onSubmit={(event) => {
            event.preventDefault();
            const website = new FormData(event.currentTarget).get("website");
            void submitStory(typeof website === "string" ? website : "");
          }} className="space-y-5 rounded-3xl border border-white/10 bg-[#0a1a28] p-6 sm:p-9">
            {USE_STORY_API && (
              <div hidden>
                <label htmlFor="story-website">Leave this field empty</label>
                <input id="story-website" name="website" tabIndex={-1} autoComplete="off" />
              </div>
            )}
            <div>
              <label htmlFor="story-title" className="text-sm font-medium">Story title</label>
              <Input id="story-title" maxLength={STORY_LIMITS.title} value={storyTitle} onChange={(event) => setStoryTitle(event.target.value)} placeholder="Example: What I wish people understood" className="mt-2 border-white/15 bg-black/20 text-white" />
            </div>
            <div>
              <label htmlFor="story-category" className="text-sm font-medium">What kind of story is this?</label>
              <select id="story-category" value={storyCategory} onChange={(event) => setStoryCategory(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-[#030b13] px-3 text-sm text-white">
                {STORY_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="story-body" className="text-sm font-medium">Your experience</label>
              <textarea id="story-body" value={storyBody} onChange={(event) => setStoryBody(event.target.value)} required maxLength={STORY_LIMITS.body} placeholder="Share the story in your own words..." className="mt-2 min-h-[220px] w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-slate-500 focus:border-[#62cbb0]" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name-preference" className="text-sm font-medium">Name to use if published</label>
                <select id="name-preference" value={namePreference} onChange={(event) => setNamePreference(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-[#030b13] px-3 text-sm text-white">
                  {STORY_NAME_PREFERENCES.map((preference) => <option key={preference}>{preference}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="submitter-name" className="text-sm font-medium">Name for our review (optional)</label>
                <Input id="submitter-name" maxLength={STORY_LIMITS.name} value={submitterName} onChange={(event) => setSubmitterName(event.target.value)} placeholder="Optional" className="mt-2 border-white/15 bg-black/20 text-white" />
              </div>
            </div>
            <div>
              <label htmlFor="submitter-email" className="text-sm font-medium">Email for follow-up (optional)</label>
              <Input id="submitter-email" maxLength={STORY_LIMITS.email} aria-describedby="story-contact-help" type="email" value={submitterEmail} onChange={(event) => setSubmitterEmail(event.target.value)} placeholder="Only if you'd like us to be able to follow up" className="mt-2 border-white/15 bg-black/20 text-white" />
              <p id="story-contact-help" className="mt-2 text-sm leading-6 text-slate-300">By providing an email, you invite us to contact you about this submission. We receive any name or email you enter for review. An anonymous publication preference applies to the published story.</p>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-white/15 bg-black/20 p-4 text-sm leading-6 text-slate-300">
              <input type="checkbox" checked={permissionGranted} onChange={(event) => setPermissionGranted(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" />
              <span>Yes, I give Stabile USA permission to adapt, edit, narrate, and publish this story. I understand that names, locations, and identifying details may be changed.</span>
            </label>
            <Button type="submit" disabled={storySubmitting} className="rounded-full bg-[#62cbb0] px-6 text-[#041723] hover:bg-[#8ce2ca]">{storySubmitting ? "Submitting..." : "Submit your story"}</Button>
            {storyMessage && <p role="status" aria-live="polite" className="text-sm leading-6 text-slate-200">{storyMessage}</p>}
          </form>
        </div>
      </section>

      {/* OTHER PROJECTS: preserve discovery without letting it dominate the homepage. */}
      <section id="projects" className="bg-[#07121d]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d7af65]">More from Stabile USA</p>
          <h2 className="mt-4 text-3xl font-medium sm:text-4xl">Our Projects</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">Stabile USA also creates practical digital tools, educational resources, original entertainment, and independent media projects.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROJECTS.map((project) => (
              <a href={project.href} target="_blank" rel="noopener noreferrer" key={project.name} className="rounded-2xl border border-white/10 bg-[#0b1a29] p-5 transition hover:border-[#8bd5be]/40">
                <h3 className="text-lg font-medium">{project.name} ↗</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{project.description}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Voice() {
  return (
    <section className="bg-[#071e2d] text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
        <div>
          <h1 className="text-4xl font-medium sm:text-5xl">Voice &amp; Production</h1>
          <p className="mt-5 leading-8 text-slate-300">
            Pamela J. Terrell is the founder and founding voice of Stabile USA. She brings a reflective, emotionally grounded delivery to story and audiobook narration, documentary-style projects, and other voiceover work.
          </p>
          <p className="mt-4 leading-8 text-slate-300">
            We welcome inquiries from clients and from writers, narrators, and creative collaborators interested in future productions.
          </p>
          <Button asChild className="mt-7 rounded-full bg-[#d7af65] text-black hover:bg-[#e8ca91]">
            <Link to="/contact">Inquire about a project</Link>
          </Button>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#061523] p-6 sm:p-9">
          <p className="text-sm font-medium text-[#8bd5be]">Narration by Pamela J. Terrell</p>
          <h2 id="voice-sample" className="mt-3 text-2xl font-medium">You Were Right… But You Never Said Sorry</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">A free Night Listener story about being right and the cost of holding back an apology.</p>
          <audio
            aria-labelledby="voice-sample"
            className="mt-5 w-full"
            controls
            preload="none"
            src="/audio/say-sorry-ep3.mp3"
          />
          <Link to="/listen" className="mt-5 inline-block text-sm font-medium text-[#8bd5be] underline underline-offset-4">
            Explore Night Listener
          </Link>
        </div>
      </div>
    </section>
  );
}

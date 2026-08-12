import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const FORM_ENDPOINT = "https://formspree.io/f/xykjjvdb";

export default function Contact() {
  return (
    <section className="w-full bg-[#02060b] text-white">
      <div
        className="
          mx-auto
          w-full
          max-w-[1600px]
          px-5
          py-14

          sm:px-8
          sm:py-18

          lg:px-12
          lg:py-20

          xl:px-16
          2xl:px-20
        "
      >
        {/* ======================================================
            INTRO
        ====================================================== */}

        <header className="mx-auto max-w-5xl text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d7af65]">
            Contact Stabile USA
          </p>

          <h1 className="mt-5 text-3xl font-medium tracking-[-0.035em] sm:text-4xl lg:text-5xl">
            Let&apos;s talk about what you&apos;re building.
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-slate-400 sm:text-lg">
            For voice narration, website projects, creative
            collaborations, listener messages, or membership
            support, send a note below.
          </p>
        </header>

        {/* ======================================================
            SERVICES
        ====================================================== */}

        <section className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {/* VOICE WORK */}

          <Card className="h-full rounded-[1.75rem] border-white/10 bg-[#07101a] text-white shadow-[0_25px_70px_rgba(0,0,0,.2)]">
            <CardContent className="flex h-full flex-col p-6 sm:p-7 lg:p-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d7af65]">
                Voice
              </p>

              <h2 className="mt-4 text-xl font-medium tracking-[-0.025em] sm:text-2xl">
                Voice work
              </h2>

              <p className="mt-4 text-sm leading-7 text-slate-400">
                Professional voice work for storytelling,
                brand narration, and audio-driven experiences.
                Calm, clear, emotionally grounded delivery with
                the ability to adapt tone, pacing, and style
                across different formats and projects.
              </p>
            </CardContent>
          </Card>

          {/* WEB DESIGN */}

          <Card className="h-full rounded-[1.75rem] border-white/10 bg-[#07101a] text-white shadow-[0_25px_70px_rgba(0,0,0,.2)]">
            <CardContent className="flex h-full flex-col p-6 sm:p-7 lg:p-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d7af65]">
                Digital
              </p>

              <h2 className="mt-4 text-xl font-medium tracking-[-0.025em] sm:text-2xl">
                Web design & development
              </h2>

              <p className="mt-4 text-sm leading-7 text-slate-400">
                Thoughtful, modern websites and digital
                experiences built around clarity, structure,
                usability, strong visual identity, and the
                needs of the actual project.
              </p>
            </CardContent>
          </Card>

          {/* COLLABORATIONS */}

          <Card className="h-full rounded-[1.75rem] border-white/10 bg-[#07101a] text-white shadow-[0_25px_70px_rgba(0,0,0,.2)] md:col-span-2 xl:col-span-1">
            <CardContent className="flex h-full flex-col p-6 sm:p-7 lg:p-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d7af65]">
                Collaboration
              </p>

              <h2 className="mt-4 text-xl font-medium tracking-[-0.025em] sm:text-2xl">
                Creative collaborations
              </h2>

              <p className="mt-4 text-sm leading-7 text-slate-400">
                Select collaborations involving storytelling,
                original media, human behavior, useful
                information, digital experiences, and ideas
                that benefit from a cross-disciplinary
                approach.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* ======================================================
            CONTACT FORM
        ====================================================== */}

        <section className="mt-8">
          <Card className="rounded-[2rem] border-white/10 bg-[#050a11] text-white shadow-[0_35px_100px_rgba(0,0,0,.25)]">
            <CardContent className="p-6 sm:p-8 lg:p-10 xl:p-12">
              <div className="grid gap-10 lg:grid-cols-[0.65fr_1.35fr] lg:items-start">
                {/* LEFT COPY */}

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d7af65]">
                    Work with me
                  </p>

                  <h2 className="mt-4 text-2xl font-medium tracking-[-0.03em] sm:text-3xl">
                    Tell me what you have in mind.
                  </h2>

                  <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                    This form is open for voice narration
                    inquiries, website design and development
                    projects, creative collaborations, listener
                    messages, and Night Listener membership
                    support.
                  </p>

                  <div className="mt-7 rounded-2xl border border-white/10 bg-black/20 p-5">
                    <p className="text-sm font-medium text-white">
                      Helpful details to include
                    </p>

                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-500">
                      <li>
                        • For voice work: project type, word count,
                        usage, and timeline.
                      </li>

                      <li>
                        • For websites: type of site, goals,
                        features, and timeline.
                      </li>

                      <li>
                        • For collaborations: what you&apos;re
                        creating and why you think it may be a fit.
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6 text-sm text-slate-500">
                    Prefer email?{" "}
                    <a
                      href="mailto:listen@stabileusa.com"
                      className="text-[#d7af65] underline underline-offset-4 transition hover:text-[#efd296]"
                    >
                      listen@stabileusa.com
                    </a>
                  </div>
                </div>

                {/* FORM */}

                <form
                  action={FORM_ENDPOINT}
                  method="POST"
                  className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 sm:p-6 lg:p-7"
                >
                  <input
                    type="hidden"
                    name="_subject"
                    value="New message from stabileusa.com"
                  />

                  <input
                    type="hidden"
                    name="_next"
                    value="https://stabileusa.com/contact-thanks"
                  />

                  <input
                    type="text"
                    name="_gotcha"
                    style={{ display: "none" }}
                    tabIndex={-1}
                    autoComplete="off"
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label
                        className="text-sm font-medium text-white"
                        htmlFor="name"
                      >
                        Name
                      </label>

                      <Input
                        id="name"
                        name="name"
                        placeholder="Your name"
                        required
                        className="border-white/10 bg-[#03070d] text-white placeholder:text-slate-700"
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        className="text-sm font-medium text-white"
                        htmlFor="email"
                      >
                        Email
                      </label>

                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="you@example.com"
                        required
                        className="border-white/10 bg-[#03070d] text-white placeholder:text-slate-700"
                      />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <label
                      className="text-sm font-medium text-white"
                      htmlFor="message"
                    >
                      Message
                    </label>

                    <Textarea
                      id="message"
                      name="message"
                      placeholder="Tell me a little about your inquiry. For voice work, include project type, word count, usage, and timeline. For websites, include the type of site, your goals, and timeline."
                      className="min-h-[220px] border-white/10 bg-[#03070d] text-white placeholder:text-slate-700"
                      required
                    />
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button
                      type="submit"
                      className="h-11 rounded-full bg-[#d7af65] px-7 text-black hover:bg-[#e7ca90]"
                    >
                      Send message
                    </Button>

                    <p className="text-xs leading-5 text-slate-600">
                      You&apos;ll see a confirmation page after
                      your message is sent.
                    </p>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ======================================================
            BOTTOM NOTE
        ====================================================== */}

        <div className="mx-auto mt-10 max-w-3xl text-center">
          <p className="text-xs leading-6 text-slate-600">
            Stabile USA receives inquiries for selected voice,
            digital, creative, and project-based work.
          </p>
        </div>
      </div>
    </section>
  );
}
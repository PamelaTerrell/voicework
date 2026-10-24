import { useState } from "react";
import { Link } from "react-router-dom";

export default function QuestionOfTheWeek() {
  const [reflection, setReflection] = useState("");
  const [publicPermission, setPublicPermission] = useState(false);
  const [narrationPermission, setNarrationPermission] = useState(false);

  return (
    <main className="min-h-screen bg-[#030b13] px-5 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="text-sm text-[#86d6be] hover:underline"
        >
          ← Back to The Human Experience
        </Link>

        <p className="mt-14 text-xs font-semibold uppercase tracking-[0.25em] text-[#86d6be]">
          Stabile USA · The Human Experience
        </p>

        <h1 className="mt-5 text-4xl font-medium sm:text-5xl">
          The Question of the Week
        </h1>

        <p className="mt-5 text-slate-300">
          Every life has a story. Every perspective matters.
        </p>

        <section className="mt-12 rounded-3xl border border-[#65cfb4]/25 bg-[#082536] p-7 sm:p-10">
          <p className="text-xs uppercase tracking-widest text-[#86d6be]">
            Question 001
          </p>

          <h2 className="mt-6 text-2xl font-medium leading-snug sm:text-3xl">
            What is something people have judged you for
            without knowing the whole story?
          </h2>

          <p className="mt-6 leading-8 text-slate-300">
            Sometimes people see our decisions without
            understanding the circumstances behind them.
            What would you want them to know?
          </p>
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-[#0a1a28] p-7 sm:p-10">
          <h2 className="text-2xl font-medium">
            Share your experience
          </h2>

          <p className="mt-4 text-sm leading-7 text-slate-300">
            You may write as much or as little as you feel
            comfortable sharing. We are here to understand,
            not judge.
          </p>

          <label
            htmlFor="reflection"
            className="mt-8 block text-sm font-medium"
          >
            Your reflection
          </label>

          <textarea
            id="reflection"
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            maxLength={5000}
            placeholder="There is something about my experience that people don't understand..."
            className="mt-3 min-h-[220px] w-full rounded-xl border border-white/20 bg-[#04111d] p-4 leading-7 text-white outline-none placeholder:text-slate-500 focus:border-[#65cfb4]"
          />

          <p className="mt-3 text-xs text-slate-400">
            {reflection.length} / 5000 characters
          </p>

          <div className="mt-8 space-y-5">
            <p className="text-sm font-medium">
              How would you like your response used?
            </p>

            <p className="text-sm leading-7 text-slate-300">
              Private review would be the default.
              Additional uses require your permission.
            </p>

            <label className="flex items-start gap-3 text-sm leading-6 text-slate-300">
              <input
                type="checkbox"
                checked={publicPermission}
                onChange={(event) =>
                  setPublicPermission(event.target.checked)
                }
                className="mt-1"
              />
              I would permit an approved, de-identified
              version of my response to be published.
            </label>

            <label className="flex items-start gap-3 text-sm leading-6 text-slate-300">
              <input
                type="checkbox"
                checked={narrationPermission}
                onChange={(event) =>
                  setNarrationPermission(event.target.checked)
                }
                className="mt-1"
              />
              I would permit my response to be considered
              for a narrated story.
            </label>
          </div>

          <div className="mt-9 rounded-xl border border-[#65cfb4]/20 bg-[#041723] p-5">
            <p className="text-sm font-medium text-[#86d6be]">
              Submission setup in progress
            </p>

            <p className="mt-2 text-sm leading-7 text-slate-300">
              This page is currently a preview. Responses
              cannot be submitted until secure storage,
              consent handling, and privacy protections
              are connected.
            </p>
          </div>

          <button
            type="button"
            disabled
            className="mt-7 rounded-full bg-[#65cfb4] px-8 py-3 font-semibold text-[#041723] opacity-50"
          >
            Submit Reflection
          </button>
        </section>
      </div>
    </main>
  );
}

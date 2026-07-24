import React from "react";

const FEATURED_BOOK = {
  title: "Anne of Green Gables",
  author: "L. M. Montgomery",
  year: "1908",
  chapterTitle: "Chapter 1: Mrs. Rachel Lynde Is Surprised",
  audioSrc: "/audio/classics/anne-of-green-gables-chapter-1.mp3",
};

const chapters = [
  {
    number: "Chapter 1",
    title: "Mrs. Rachel Lynde Is Surprised",
    description:
      "A quiet village, a watchful neighbor, and the unexpected beginning of Anne’s story.",
    status: "available",
    audioSrc: "/audio/classics/anne-of-green-gables-chapter-1.mp3",
  },
  {
    number: "Chapter 2",
    title: "Matthew Cuthbert Is Surprised",
    description:
      "Matthew arrives at the train station expecting a boy — and finds Anne instead.",
    status: "coming-soon",
  },
];

export default function Classics() {
  return (
    <div className="overflow-hidden rounded-3xl bg-[#f8f1e8] text-[#2f241d]">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-16 text-center">
        <p className="mb-3 text-sm uppercase tracking-[0.25em] text-[#8a5f45]">
          Stabile USA Night Listener
        </p>

        <h1 className="font-serif text-4xl font-semibold tracking-tight md:text-6xl">
          Classic Night Readings
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#5f4a3c]">
          Public-domain stories, read slowly for quiet evenings. A softer corner
          of Stabile USA where timeless books can become gentle company at the
          end of the day.
        </p>
      </section>

      {/* Featured Book */}
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <div className="overflow-hidden rounded-3xl border border-[#dcc8b7] bg-[#fffaf4] shadow-sm">
          <div className="grid gap-0 md:grid-cols-[0.9fr_1.1fr]">
            {/* Book card visual */}
            <div className="flex items-center justify-center bg-[#6f8b6b] p-10">
              <div className="w-full max-w-xs rounded-2xl border border-[#ead8c6] bg-[#2f3d2f] px-8 py-12 text-center text-[#f7eadb] shadow-xl">
                <p className="text-sm uppercase tracking-[0.25em] opacity-80">
                  Now Reading
                </p>

                <h2 className="mt-6 font-serif text-4xl leading-tight">
                  Anne of Green Gables
                </h2>

                <p className="mt-6 text-sm tracking-wide">
                  L. M. Montgomery
                </p>

                <div className="mx-auto mt-8 h-px w-20 bg-[#f7eadb]/60" />

                <p className="mt-8 text-sm italic opacity-90">
                  Read by Pamela J. Terrell
                </p>
              </div>
            </div>

            {/* Featured content */}
            <div className="p-8 md:p-10">
              <p className="text-sm uppercase tracking-[0.2em] text-[#8a5f45]">
                Featured Classic
              </p>

              <h2 className="mt-3 font-serif text-3xl font-semibold md:text-4xl">
                {FEATURED_BOOK.title}
              </h2>

              <p className="mt-2 text-[#6b5546]">
                by {FEATURED_BOOK.author} · First published in{" "}
                {FEATURED_BOOK.year}
              </p>

              <p className="mt-6 leading-8 text-[#4f3d32]">
                <em>Anne of Green Gables</em> follows Anne Shirley, an
                imaginative orphan whose arrival at Green Gables changes the
                lives of everyone around her. These readings are offered in the
                calm, reflective style of Stabile USA Night Listener.
              </p>

              <div className="mt-8 rounded-2xl border border-[#e5d3c3] bg-[#f8f1e8] p-5">
                <h3 className="font-serif text-2xl">
                  {FEATURED_BOOK.chapterTitle}
                </h3>

                <p className="mt-2 text-sm text-[#6b5546]">
                  Read by Pamela J. Terrell
                </p>

                <audio
                  className="mt-5 w-full"
                  controls
                  preload="metadata"
                  src={FEATURED_BOOK.audioSrc}
                >
                  Your browser does not support the audio element.
                </audio>

                <p className="mt-4 text-xs leading-6 text-[#7a6353]">
                  Text based on a public-domain edition. Recording created for
                  Stabile USA Night Listener.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Chapters */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[#8a5f45]">
              Available Chapters
            </p>

            <h2 className="mt-2 font-serif text-3xl font-semibold">
              Anne of Green Gables
            </h2>
          </div>
        </div>

        <div className="grid gap-5">
          {chapters.map((chapter) => (
            <article
              key={chapter.number}
              className="rounded-2xl border border-[#dcc8b7] bg-[#fffaf4] p-6 shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.15em] text-[#8a5f45]">
                    {chapter.number}
                  </p>

                  <h3 className="mt-2 font-serif text-2xl font-semibold">
                    {chapter.title}
                  </h3>

                  <p className="mt-3 max-w-2xl leading-7 text-[#5f4a3c]">
                    {chapter.description}
                  </p>
                </div>

                <div className="shrink-0">
                  {chapter.status === "available" ? (
                    <span className="rounded-full bg-[#6f8b6b] px-4 py-2 text-sm font-medium text-white">
                      Available
                    </span>
                  ) : (
                    <span className="rounded-full border border-[#d9c3b2] px-4 py-2 text-sm font-medium text-[#8a5f45]">
                      Coming Soon
                    </span>
                  )}
                </div>
              </div>

              {chapter.status === "available" && chapter.audioSrc && (
                <audio
                  className="mt-5 w-full"
                  controls
                  preload="metadata"
                  src={chapter.audioSrc}
                >
                  Your browser does not support the audio element.
                </audio>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="rounded-3xl border border-[#dcc8b7] bg-[#efe1d1] p-8 md:p-10">
          <h2 className="font-serif text-3xl font-semibold">
            About Classic Night Readings
          </h2>

          <p className="mt-4 leading-8 text-[#4f3d32]">
            Classic Night Readings features public-domain literature read aloud
            by Pamela J. Terrell. These recordings are created for quiet
            evenings, rest, reflection, and gentle company.
          </p>

          <p className="mt-4 text-sm leading-7 text-[#6b5546]">
            These readings are separate from original Stabile USA Night Listener
            episodes, but they share the same peaceful intention: a soft place
            to land at the end of the day.
          </p>
        </div>
      </section>
    </div>
  );
}
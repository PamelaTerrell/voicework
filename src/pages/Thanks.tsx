import { Link, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Thanks() {
  const { state } = useLocation();
  // Optional: if you ever pass { state: { formType: "night_list" } } on navigation
  const formType = state?.formType;

  const title =
    formType === "night_list" ? "You’re on the Night List 🌙" : "Thank you!";
  const subtitle =
    formType === "night_list"
      ? "You’ll get new episode releases and early access as the library grows."
      : "Your message was sent successfully. I’ll get back to you as soon as I can.";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </header>

      <Card className="overflow-hidden">
        <CardContent className="space-y-5 p-6">
          <div className="rounded-2xl border bg-background p-5">
            <p className="text-sm font-medium">What happens next</p>

            {formType === "night_list" ? (
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                <li>• New previews will appear on the Listen page</li>
                <li>• The Night List gets first access when full episodes launch</li>
                <li>• You’ll also get occasional cozy notes (no spam)</li>
              </ul>
            ) : (
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                <li>• I’ll reply with timing and any clarifying questions</li>
                <li>• If you have a script, feel free to include it in your reply</li>
                <li>• Delivery formats available: WAV or MP3</li>
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-11">
              <Link to="/listen">Listen to previews</Link>
            </Button>

            <Button asChild variant="outline" className="h-11">
              <Link to="/">Back to home</Link>
            </Button>
          </div>

          <div className="rounded-2xl border bg-muted/30 p-5">
            <p className="text-sm font-medium">Want early access?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Join the Night List to get new releases and founding-listener perks.
            </p>
            <Button asChild className="mt-3 w-full sm:w-auto">
              <Link to="/join">Join the Night List</Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Prefer email?{" "}
            <a
              className="underline underline-offset-4 hover:text-foreground"
              href="mailto:agentpamelajterrell@gmail.com"
            >
              agentpamelajterrell@gmail.com
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ContactThanks() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-xl rounded-2xl border bg-background shadow-sm">
        <CardContent className="space-y-6 p-10 text-center">
          <div className="text-2xl">✉️</div>

          <h1 className="text-3xl font-semibold tracking-tight">
            Message received
          </h1>

          <p className="leading-7 text-muted-foreground">
            Thank you for reaching out. Your message has been sent, and I’ll get
            back to you as soon as I can.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link to="/listen">Listen to stories</Link>
            </Button>

            <Button asChild variant="outline">
              <Link to="/">Back to home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
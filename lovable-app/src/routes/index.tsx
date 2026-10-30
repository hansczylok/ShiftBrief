import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/incoming" });
  },
  head: () => ({
    meta: [
      { title: "ShiftBrief" },
      { name: "description", content: "Voice shift handovers, translated for the next shift." },
      { property: "og:title", content: "ShiftBrief" },
      { property: "og:description", content: "Voice shift handovers, translated for the next shift." },
    ],
  }),
});

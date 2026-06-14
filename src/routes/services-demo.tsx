import { createFileRoute } from "@tanstack/react-router";

import { CampaignEditorScreen } from "@/features/campaign-editor/components/CampaignEditorScreen";

export const Route = createFileRoute("/services-demo")({
  head: () => ({
    meta: [
      { title: "Campaign editor — domains & DI — Forge" },
      {
        name: "description",
        content:
          "Industrial structure (RFC-003): pure business domains mounted on a composite scope tree, an application orchestrating them, and a UI store outside the container.",
      },
    ],
  }),
  component: CampaignEditorScreen,
});

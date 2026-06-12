import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Checkbox, Input, Radio, RadioGroup, Select } from "@/framework";
import { PageHeader, Showcase, DemoSurface, Field } from "@/playground/components/primitives";

export const Route = createFileRoute("/components")({
  head: () => ({
    meta: [
      { title: "Components — Forge" },
      {
        name: "description",
        content: "The Forge component catalog: buttons, inputs and form primitives.",
      },
    ],
  }),
  component: Components,
});

function Components() {
  const [checked, setChecked] = useState(true);
  const [radio, setRadio] = useState("react");
  const [framework, setFramework] = useState("vite");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Catalog"
        title="Components"
        description="The foundational primitives. Minimal by design — the goal is a clean, consistent surface that future work can extend."
      />

      <Showcase
        title="Button"
        description="Six variants × four sizes via class-variance-authority."
      >
        <DemoSurface>
          <Button variant="primary">Primary</Button>
          <Button variant="brand">Brand</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </DemoSurface>
        <DemoSurface className="mt-4">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </DemoSurface>
      </Showcase>

      <div className="grid gap-6 lg:grid-cols-2">
        <Showcase title="Checkbox & Radio" description="Native controls, custom indicators.">
          <div className="flex flex-col gap-5">
            <Checkbox
              label="Enable experimental engines"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <RadioGroup name="lib" value={radio} onValueChange={setRadio}>
              <Radio value="react" label="React" />
              <Radio value="solid" label="Solid (planned)" disabled />
              <Radio value="vue" label="Vue (planned)" disabled />
            </RadioGroup>
            <p className="font-mono text-xs text-muted-foreground">
              checked={String(checked)} · radio="{radio}"
            </p>
          </div>
        </Showcase>

        <Showcase title="Input & Select" description="Form-ready field primitives.">
          <div className="flex flex-col gap-4">
            <Field label="Project name">
              <Input placeholder="my-component-lib" />
            </Field>
            <Field label="Bundler" hint="Native select, styled with tokens.">
              <Select
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                options={[
                  { label: "Vite", value: "vite" },
                  { label: "Rspack", value: "rspack" },
                  { label: "Turbopack", value: "turbopack" },
                ]}
              />
            </Field>
          </div>
        </Showcase>
      </div>
    </div>
  );
}

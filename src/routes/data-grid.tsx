import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { DataGrid, Input, type ColumnDef } from "@/framework";
import { getUsers, type User } from "@/fixtures";
import { formatDate } from "@/utils/format";
import {
  PageHeader,
  Showcase,
  StatusPill,
  Field,
} from "@/playground/components/primitives";

export const Route = createFileRoute("/data-grid")({
  head: () => ({
    meta: [
      { title: "Data Grid — Forge" },
      { name: "description", content: "Sortable, filterable, selectable data grid with a virtualization placeholder." },
    ],
  }),
  component: DataGridPage,
});

const columns: ColumnDef<User>[] = [
  { id: "name", header: "Name", accessor: "name", sortable: true },
  { id: "email", header: "Email", accessor: "email" },
  { id: "team", header: "Team", accessor: "team", sortable: true },
  {
    id: "status",
    header: "Status",
    accessor: "status",
    sortable: true,
    cell: (r) => <StatusPill status={r.status} />,
  },
  { id: "score", header: "Score", accessor: "score", sortable: true, align: "right" },
  {
    id: "signupDate",
    header: "Signed up",
    accessor: "signupDate",
    sortable: true,
    cell: (r) => formatDate(r.signupDate),
  },
];

function DataGridPage() {
  const data = useMemo(() => getUsers(200), []);
  const [filter, setFilter] = useState("");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Flagship component"
        title="Data Grid"
        description="Headless state (sort · filter · select) is separated from rendering. Row and cell renderers are independent extension points — a virtualized renderer can drop in without touching the engine."
      />

      <Showcase title="Simple grid" description="Static columns with custom cell renderers.">
        <DataGrid data={data.slice(0, 8)} columns={columns} getRowId={(r) => r.id} />
      </Showcase>

      <Showcase
        title="Sortable + filterable + selectable"
        description="Click headers to sort. Type to filter across all columns. Checkboxes select rows."
      >
        <div className="mb-4 max-w-xs">
          <Field label="Filter">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search users…"
            />
          </Field>
        </div>
        <DataGrid
          data={data}
          columns={columns}
          getRowId={(r) => r.id}
          selectable
          filterText={filter}
          initialSort={{ columnId: "score", direction: "desc" }}
          maxHeight={420}
        />
      </Showcase>

      <Showcase
        title="Virtualized grid"
        description="Placeholder — the architecture reserves a custom row renderer for windowing."
      >
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 py-12 text-center">
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            virtualization engine · planned
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            See the Virtualization page for a working windowed list, and{" "}
            <code className="font-mono text-xs">DataGrid/README.md</code> for the
            integration plan.
          </p>
        </div>
      </Showcase>
    </div>
  );
}

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataGrid, type ColumnDef } from "@/framework";

interface Row {
  id: string;
  name: string;
  score: number;
}

const data: Row[] = [
  { id: "1", name: "Charlie", score: 30 },
  { id: "2", name: "Alpha", score: 10 },
  { id: "3", name: "Bravo", score: 20 },
];

const columns: ColumnDef<Row>[] = [
  { id: "name", header: "Name", accessor: "name", sortable: true },
  { id: "score", header: "Score", accessor: "score", sortable: true },
];

describe("DataGrid", () => {
  it("renders a row per data item", () => {
    render(<DataGrid data={data} columns={columns} getRowId={(r) => r.id} />);
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("filters rows by text", () => {
    render(
      <DataGrid data={data} columns={columns} getRowId={(r) => r.id} filterText="alpha" />,
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
  });

  it("sorts ascending when a sortable header is clicked", async () => {
    render(<DataGrid data={data} columns={columns} getRowId={(r) => r.id} />);
    await userEvent.click(screen.getByRole("button", { name: /Name/ }));
    const cells = screen.getAllByRole("cell").filter((c) =>
      ["Alpha", "Bravo", "Charlie"].includes(c.textContent ?? ""),
    );
    expect(cells[0]).toHaveTextContent("Alpha");
  });
});

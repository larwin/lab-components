// @vitest-environment node
import { describe, expect, it } from "vitest";
import { partitionFiles, type FileLike } from "./dropzone-core";

const file = (name: string, type: string, size = 1000): FileLike => ({ name, type, size });

describe("partitionFiles — dropzone acceptance policy", () => {
  it("accepts everything without a policy", () => {
    const result = partitionFiles([file("a.bin", "application/octet-stream")]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });

  it("matches extensions, exact mime types and mime wildcards", () => {
    const policy = { accept: ".pdf, image/*, text/plain" };
    expect(partitionFiles([file("doc.PDF", "application/pdf")], policy).accepted).toHaveLength(1);
    expect(partitionFiles([file("p.png", "image/png")], policy).accepted).toHaveLength(1);
    expect(partitionFiles([file("n.txt", "text/plain")], policy).accepted).toHaveLength(1);
    const refused = partitionFiles([file("v.mp4", "video/mp4")], policy);
    expect(refused.rejected).toEqual([{ file: refused.rejected[0].file, reason: "type" }]);
  });

  it("rejects oversize files and over-count drops", () => {
    const policy = { maxSize: 500, maxFiles: 2 };
    const result = partitionFiles(
      [
        file("ok1.txt", "text/plain", 100),
        file("big.txt", "text/plain", 900),
        file("ok2.txt", "text/plain", 200),
        file("over.txt", "text/plain", 100),
      ],
      policy,
    );
    expect(result.accepted.map((f) => f.name)).toEqual(["ok1.txt", "ok2.txt"]);
    expect(result.rejected.map((r) => [r.file.name, r.reason])).toEqual([
      ["big.txt", "size"],
      ["over.txt", "count"],
    ]);
  });

  it("builds the SR summary message", () => {
    const policy = { accept: "image/*" };
    const both = partitionFiles(
      [file("a.png", "image/png"), file("b.png", "image/png"), file("c.txt", "text/plain")],
      policy,
    );
    expect(both.message).toBe("2 fichiers acceptés, 1 refusé");
    expect(partitionFiles([], policy).message).toBe("Aucun fichier");
  });
});

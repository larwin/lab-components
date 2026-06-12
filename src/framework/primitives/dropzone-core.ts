/**
 * Dropzone acceptance policy — pure, Node-tested (the pattern of
 * characterLimit: the *decision* lives here, the DOM event wiring and the
 * live-region announcement live in the shell).
 *
 * `accept` follows the native attribute syntax: ".pdf", "image/png",
 * "image/*", comma-separated.
 */

export interface FileLike {
  readonly name: string;
  readonly type: string;
  readonly size: number;
}

export type RejectionReason = "type" | "size" | "count";

export interface FileVerdict<T extends FileLike> {
  readonly file: T;
  readonly reason: RejectionReason;
}

export interface PartitionedFiles<T extends FileLike> {
  readonly accepted: readonly T[];
  readonly rejected: readonly FileVerdict<T>[];
  /** Live-region announcement summarizing the drop. */
  readonly message: string;
}

export interface DropPolicy {
  /** Native accept syntax (".pdf,image/*"). Empty/undefined = everything. */
  accept?: string;
  /** Per-file size cap, in bytes. */
  maxSize?: number;
  /** Cap on the number of accepted files per drop. */
  maxFiles?: number;
}

const matchesAccept = (file: FileLike, patterns: readonly string[]): boolean => {
  if (patterns.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return patterns.some((raw) => {
    const pattern = raw.trim().toLowerCase();
    if (pattern === "") return false;
    if (pattern.startsWith(".")) return name.endsWith(pattern);
    if (pattern.endsWith("/*")) return type.startsWith(pattern.slice(0, -1));
    return type === pattern;
  });
};

export function partitionFiles<T extends FileLike>(
  files: readonly T[],
  policy: DropPolicy = {},
): PartitionedFiles<T> {
  const patterns = (policy.accept ?? "").split(",").filter((p) => p.trim() !== "");
  const accepted: T[] = [];
  const rejected: FileVerdict<T>[] = [];

  for (const file of files) {
    if (!matchesAccept(file, patterns)) rejected.push({ file, reason: "type" });
    else if (policy.maxSize !== undefined && file.size > policy.maxSize)
      rejected.push({ file, reason: "size" });
    else if (policy.maxFiles !== undefined && accepted.length >= policy.maxFiles)
      rejected.push({ file, reason: "count" });
    else accepted.push(file);
  }

  const parts: string[] = [];
  if (accepted.length > 0) {
    parts.push(
      `${accepted.length} fichier${accepted.length > 1 ? "s" : ""} accepté${accepted.length > 1 ? "s" : ""}`,
    );
  }
  if (rejected.length > 0) {
    parts.push(`${rejected.length} refusé${rejected.length > 1 ? "s" : ""}`);
  }
  return {
    accepted,
    rejected,
    message: parts.length > 0 ? parts.join(", ") : "Aucun fichier",
  };
}

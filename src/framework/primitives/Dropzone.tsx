import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { announceNow } from "@/framework/react";
import { partitionFiles, type DropPolicy, type FileVerdict } from "./dropzone-core";

/**
 * Dropzone / FileUpload — a native file input + an HTML5 drop target. The
 * acceptance decision is the pure `partitionFiles` policy (dropzone-core,
 * Node-tested); this shell wires drag events, forwards the verdicts and
 * speaks the summary through the shared live region. OS file drags start
 * outside the app, so there is deliberately no machine here.
 *
 * The *real* control is the (visually hidden) native input: it keeps the tab
 * stop, the keyboard activation and the picker; the decorated zone only adds
 * pointer affordances (click + drop) and renders the focus ring for it.
 */

export interface DropzoneProps extends DropPolicy {
  onFiles: (accepted: File[], rejected: FileVerdict<File>[]) => void;
  /** Allow selecting several files from the picker. */
  multiple?: boolean;
  disabled?: boolean;
  label?: string;
  hint?: string;
  className?: string;
}

export function Dropzone({
  onFiles,
  accept,
  maxSize,
  maxFiles,
  multiple = true,
  disabled = false,
  label = "Déposez vos fichiers ici",
  hint,
  className,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const handleFiles = (list: FileList | null) => {
    const files = [...(list ?? [])];
    const { accepted, rejected, message } = partitionFiles(files, { accept, maxSize, maxFiles });
    announceNow(message, rejected.length > 0 ? "assertive" : "polite");
    onFiles([...accepted], [...rejected]);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
        "focus-within:ring-2 focus-within:ring-ring",
        dragging
          ? "border-primary bg-primary/5"
          : "border-border bg-surface hover:border-muted-foreground/40",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <Upload aria-hidden className="size-6 text-muted-foreground" />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{hint ?? "ou cliquez pour parcourir"}</span>
      <input
        ref={inputRef}
        type="file"
        aria-label={label}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

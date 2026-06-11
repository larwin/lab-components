export type DndKey = string;

export type ModifierKeys = {
  alt?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
};

export type DropEffect = 'move' | 'copy' | 'link';
export type DropZone = 'before' | 'after' | 'inside' | 'none';

export type DragVersion = string;
export type DragContentType = string;

export type DragItem = {
  id: string;
  type: string;
  label?: string;
  meta?: Record<string, unknown>;
};

export type DragHeaders = {
  contentType: DragContentType;
  [key: string]: unknown;
};

export type DragData = {
  items: DragItem[];
  [key: string]: unknown;
};

export type DragPayload = {
  version: DragVersion;
  headers: DragHeaders;
  data: DragData;
};

export type DragCodec = {
  version: DragVersion;
  encode: (payload: DragPayload) => string;
  decode: (raw: string) => DragPayload | null;
};

export type DropTarget = {
  targetKey?: DndKey;
  zone: DropZone;
};

export type DndVisualState = {
  isDragging: boolean;
  payload?: DragPayload;
  over?: DropTarget;
  effect?: DropEffect;
};

export type DndPolicy = {
  enabled?: boolean;
  allowedZones?: DropZone[];
  defaultEffect?: (mods: ModifierKeys) => DropEffect;
  canDrop?: (ctx: {
    payload: DragPayload;
    target: DropTarget;
    effect: DropEffect;
    mods: ModifierKeys;
  }) => boolean;
};

export type DndAdapter<TContext, TGeometry, TIntent> = {
  getDragPayload: (ctx: TContext) => DragPayload;
  hitTest: (args: {
    pointerClientX: number;
    pointerClientY: number;
    geometry: TGeometry;
  }) => DropTarget;
  toIntent: (args: {
    payload: DragPayload;
    target: DropTarget;
    effect: DropEffect;
    mods: ModifierKeys;
    geometry: TGeometry;
    ctx: TContext;
  }) => TIntent | null;
};

export type DndEngineState = {
  phase: 'idle' | 'dragging';
  visual: DndVisualState;
};

export type DndEngine<TContext, TGeometry, TIntent> = {
  getState: () => DndEngineState;
  beginDrag: (args: {
    ctx: TContext;
    geometry: TGeometry;
    pointerClientX: number;
    pointerClientY: number;
    mods: ModifierKeys;
  }) => void;
  updatePointer: (args: {
    geometry: TGeometry;
    pointerClientX: number;
    pointerClientY: number;
    mods: ModifierKeys;
  }) => void;
  endDrag: (args: {
    geometry: TGeometry;
    pointerClientX: number;
    pointerClientY: number;
    mods: ModifierKeys;
  }) => TIntent | null;
  cancelDrag: () => void;
};

export type CreateDndEngineArgs<TContext, TGeometry, TIntent> = {
  adapter: DndAdapter<TContext, TGeometry, TIntent>;
  policy?: DndPolicy;
};

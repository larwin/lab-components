import type { Culture } from '@/core/culture';
import type { RowKindDefinition } from '@/core/collection/shared/kind';
import type { ItemId, ItemRuntime } from '@/core/collection/shared/runtime';
import type { CellKindDefinition } from './cell';
import type { CellularDOMRefs, CellularDescriptor } from './cellular';
import { RowKindCellularDefinition } from './cellular';

export interface EnrichedDescriptor extends CellularDescriptor {
  detail: string;
}

export interface EnrichedDOMRefs extends CellularDOMRefs {
  detailEl: HTMLDivElement;
}

export interface EnrichedKindOptions<
  TItem,
  TId extends ItemId = ItemId,
  TRuntime extends ItemRuntime = ItemRuntime,
> {
  height: number;
  cells: Array<CellKindDefinition<TItem, TId, TRuntime>>;
  getDetail: (item: TItem, id: TId, runtime: TRuntime, culture?: Culture) => string;
}

export class RowKindEnrichedDefinition<
  TItem,
  TId extends ItemId = ItemId,
  TRuntime extends ItemRuntime = ItemRuntime,
> implements RowKindDefinition<TItem, TId, TRuntime, EnrichedDescriptor, EnrichedDOMRefs> {
  readonly kind = 'enriched';
  readonly extends = 'cellular';
  readonly height: number;

  private readonly baseCellular: RowKindCellularDefinition<TItem, TId, TRuntime>;

  constructor(private readonly options: EnrichedKindOptions<TItem, TId, TRuntime>) {
    this.height = options.height;
    this.baseCellular = new RowKindCellularDefinition<TItem, TId, TRuntime>({
      cells: options.cells,
      height: options.height,
    });
  }

  computeDescriptor(
    item: TItem,
    id: TId,
    runtime: TRuntime,
    culture?: Culture,
    base?: () => EnrichedDescriptor
  ): EnrichedDescriptor {
    const baseDescriptor = (base?.() as CellularDescriptor | undefined)
      ?? this.baseCellular.computeDescriptor(item, id, runtime, culture);

    const detail = this.options.getDetail(item, id, runtime, culture);
    const className = baseDescriptor.className
      ? `${baseDescriptor.className} grid-row--enriched`
      : 'grid-row--enriched';

    return {
      ...baseDescriptor,
      className,
      detail,
    };
  }

  create(container: HTMLElement): EnrichedDOMRefs {
    const baseRefs = this.baseCellular.create(container);

    const detailEl = document.createElement('div');
    detailEl.className = 'grid-row__detail';
    detailEl.style.padding = '2px 12px 6px';
    detailEl.style.fontSize = '12px';
    detailEl.style.color = 'hsl(var(--muted-foreground))';
    detailEl.style.overflow = 'hidden';
    detailEl.style.textOverflow = 'ellipsis';
    detailEl.style.whiteSpace = 'nowrap';
    container.appendChild(detailEl);

    return {
      ...baseRefs,
      detailEl,
    };
  }

  update(refs: EnrichedDOMRefs, descriptor: EnrichedDescriptor, base?: () => void): void {
    base?.();
    refs.detailEl.textContent = descriptor.detail;
    refs.detailEl.style.display = descriptor.detail ? '' : 'none';
  }
}




import {
  Home,
  Brush,
  CalendarDays,
  Clock,
  Component,
  Cpu,
  DatabaseZap,
  Layers,
  SquareKanban,
  ListTree,
  Table2,
  Grid3x3,
  Gauge,
  Accessibility,
  Palette,
  Bug,
  SlidersHorizontal,
  PanelTopOpen,
  BellRing,
  TextCursorInput,
  PanelRightOpen,
  Shapes,
  PencilRuler,
  type LucideIcon,
} from "lucide-react";

export interface NavLink {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export interface NavGroup {
  label: string;
  links: NavLink[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    links: [
      { to: "/", label: "Home", icon: Home, description: "Project overview & architecture" },
      {
        to: "/components",
        label: "Components",
        icon: Component,
        description: "Component catalog",
      },
    ],
  },
  {
    label: "Next-Gen Engine",
    links: [
      {
        to: "/engine",
        label: "Engine Inspector",
        icon: Cpu,
        description: "Intents, transitions & effects live",
      },
      {
        to: "/grid-next",
        label: "DataGrid Next",
        icon: Grid3x3,
        description: "500k rows, pure grid machine",
      },
      {
        to: "/controls",
        label: "Form Controls",
        icon: SlidersHorizontal,
        description: "Champs, toggles, slider — machines pures",
      },
      {
        to: "/inputs-advanced",
        label: "Saisie avancée",
        icon: TextCursorInput,
        description: "TextArea, SearchField, TagsInput, Rating, PinInput",
      },
      {
        to: "/disclosure",
        label: "Navigation",
        icon: PanelTopOpen,
        description: "Tabs, Accordion, Select, ContextMenu",
      },
      {
        to: "/surfaces",
        label: "Surfaces",
        icon: PanelRightOpen,
        description: "Drawer, AlertDialog, Pagination, Menubar, Splitter",
      },
      {
        to: "/overlays",
        label: "Overlays",
        icon: Layers,
        description: "Menu, ComboBox, Dialog, Command palette",
      },
      {
        to: "/feedback",
        label: "Feedback",
        icon: BellRing,
        description: "Toast queue machine, Progress, Meter",
      },
      {
        to: "/statics",
        label: "Statiques",
        icon: Shapes,
        description: "Alert, Badge, Avatar, Card, Skeleton, Dropzone",
      },
      {
        to: "/dates",
        label: "Dates",
        icon: CalendarDays,
        description: "Calendar, DateField, pickers — DateValue pur, i18n Intl",
      },
      {
        to: "/time",
        label: "Temps",
        icon: Clock,
        description: "TimeField, TimePicker ×4, fuseaux — tout dérive d'Intl",
      },
      {
        to: "/toolbar",
        label: "Toolbar",
        icon: PencilRuler,
        description: "Roving APG, débordement « … », pilule flottante",
      },
      {
        to: "/data-loader",
        label: "Data Loader",
        icon: DatabaseZap,
        description: "Async machine, races & cancellation",
      },
      {
        to: "/kanban",
        label: "Kanban",
        icon: SquareKanban,
        description: "Drag & drop machine, keyboard included",
      },
      {
        to: "/canvas-grid",
        label: "Canvas Grid",
        icon: Brush,
        description: "Second renderer — 1M rows, no React",
      },
    ],
  },
  {
    label: "Collections",
    links: [
      {
        to: "/collections",
        label: "Collections",
        icon: ListTree,
        description: "Lists, trees & menus",
      },
      {
        to: "/data-grid",
        label: "Data Grid",
        icon: Table2,
        description: "Sortable, filterable, selectable",
      },
      {
        to: "/virtualization",
        label: "Virtualization",
        icon: Gauge,
        description: "Large datasets & metrics",
      },
    ],
  },
  {
    label: "Platform",
    links: [
      {
        to: "/accessibility",
        label: "Accessibility",
        icon: Accessibility,
        description: "Keyboard, focus & ARIA",
      },
      { to: "/theming", label: "Theming", icon: Palette, description: "Tokens & dark mode" },
      { to: "/debug", label: "Debug", icon: Bug, description: "State, events & logs" },
    ],
  },
];

export const ALL_LINKS: NavLink[] = NAV_GROUPS.flatMap((g) => g.links);

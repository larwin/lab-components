/**
 * @forge/primitives — next-generation components built on the pure core.
 *
 * Each primitive is a thin React shell over a composed machine:
 * logic, keyboard maps and ARIA come from @/framework/core behaviors;
 * effects (focus, scroll, announce, output events) are interpreted by
 * @/framework/react. The same machines could power another framework.
 */

export { Button, type ButtonProps } from "./Button";
export { Checkbox, type CheckboxProps } from "./Checkbox";
export { Switch, type SwitchProps } from "./Switch";
export { Toggle, type ToggleProps } from "./Toggle";
export { ToggleGroup, type ToggleGroupProps, type ToggleGroupItemDef } from "./ToggleGroup";
export { RadioGroup, type RadioGroupProps, type RadioItemDef } from "./RadioGroup";
export { TextField, type TextFieldProps } from "./TextField";
export { TextArea, type TextAreaProps } from "./TextArea";
export { SearchField, type SearchFieldProps } from "./SearchField";
export { TagsInput, type TagsInputProps } from "./TagsInput";
export { Rating, type RatingProps } from "./Rating";
export { PinInput, type PinInputProps } from "./PinInput";
export { NumberField, type NumberFieldProps } from "./NumberField";
export { Slider, type SliderProps } from "./Slider";
export {
  Field,
  Form,
  useFieldContext,
  useFormField,
  fieldControlProps,
  type FieldProps,
  type FormProps,
  type FieldContextValue,
  type FormFieldRegistration,
} from "./Field";
export { Listbox, type ListboxProps } from "./Listbox";
export { TreeView, type TreeViewProps, type TreeSourceNode } from "./TreeView";
export { Menu, type MenuProps, type MenuItemDef, type MenuSectionDef } from "./Menu";
export { ContextMenu, type ContextMenuProps } from "./ContextMenu";
export { Tabs, type TabsProps, type TabDef } from "./Tabs";
export { Accordion, type AccordionProps, type AccordionItemDef } from "./Accordion";
export { Select, type SelectProps, type SelectOptionDef } from "./Select";
export { ToastProvider, useToast, type ToastProviderProps, type ToastOptions } from "./Toast";
export { Progress, type ProgressProps } from "./Progress";
export { Meter, type MeterProps } from "./Meter";
export { ComboBox, type ComboBoxProps } from "./ComboBox";
export { CommandPalette, type CommandPaletteProps, type CommandDef } from "./CommandPalette";
export { Dialog, type DialogProps } from "./Dialog";
export { Drawer, type DrawerProps, type DrawerSide } from "./Drawer";
export { AlertDialog, type AlertDialogProps } from "./AlertDialog";
export { Pagination, type PaginationProps } from "./Pagination";
export { Breadcrumbs, type BreadcrumbsProps, type BreadcrumbItemDef } from "./Breadcrumbs";
export { Menubar, type MenubarProps, type MenubarMenu } from "./Menubar";
export { Splitter, type SplitterProps } from "./Splitter";
export { Toolbar, FloatingToolbar, type ToolbarProps, type FloatingToolbarProps } from "./Toolbar";
export { Carousel, type CarouselProps, type CarouselSlideDef } from "./Carousel";
export {
  ColorPicker,
  type ColorPickerProps,
  type ColorPickerLabels,
  type ColorSwatchDef,
} from "./ColorPicker";
export {
  type ToolbarItemDef,
  type ToolbarButtonDef,
  type ToolbarToggleDef,
  type ToolbarToggleGroupDef,
  type ToolbarSelectDef,
  type ToolbarSeparatorDef,
  type ToolbarSelectOptionDef,
} from "./toolbar-core";
export { Alert, type AlertProps } from "./Alert";
export { Badge, type BadgeProps } from "./Badge";
export { Avatar, type AvatarProps } from "./Avatar";
export { Card, type CardProps } from "./Card";
export { Separator, type SeparatorProps } from "./Separator";
export { Skeleton, type SkeletonProps } from "./Skeleton";
export { Spinner, type SpinnerProps } from "./Spinner";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { Dropzone, type DropzoneProps } from "./Dropzone";
export { Calendar, type CalendarProps, type CalendarLabels } from "./Calendar";
export { DateField, type DateFieldProps } from "./DateField";
export { DatePicker, type DatePickerProps } from "./DatePicker";
export { DateRangePicker, type DateRangePickerProps } from "./DateRangePicker";
export { TimeField, type TimeFieldProps } from "./TimeField";
export { TimePicker, type TimePickerProps, type TimePickerVariant } from "./TimePicker";
export { TimeZoneSelect, type TimeZoneSelectProps } from "./TimeZoneSelect";
export { DateTimeField, type DateTimeFieldProps } from "./DateTimeField";
export { DateTimePicker, type DateTimePickerProps } from "./DateTimePicker";
export { Tooltip, type TooltipProps } from "./Tooltip";
export { Popover, type PopoverProps } from "./Popover";
export { KanbanBoard, type KanbanProps, type KanbanColumnDef } from "./Kanban";
export { DataGrid, type DataGridProps, type GridColumn } from "./datagrid/DataGrid";
export {
  createGridMachine,
  gridIntents,
  clipboardCopy,
  GRID_KEYMAP,
  type GridState,
  type GridConfig,
  type GridCursor,
  type GridEditing,
} from "./datagrid/gridMachine";

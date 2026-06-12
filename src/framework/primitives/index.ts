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
export { ComboBox, type ComboBoxProps } from "./ComboBox";
export { CommandPalette, type CommandPaletteProps, type CommandDef } from "./CommandPalette";
export { Dialog, type DialogProps } from "./Dialog";
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

import { ReactElement } from 'react'

import { editableKey } from './editableKey'

export type StateRef<S> = [S, React.Dispatch<React.SetStateAction<S>>]

export type EditStatus<Row> = { pristine: Row; isDirty: boolean; isNew: boolean; isRemoved: boolean }
// TODO: Don't want isNew and isRemoved to both be true, enum is probably better. isNew || isRemoved imples isDirty.

// Cells cannot be added or removed, so we have a simpler edit status.
// TODO: Do we need to make it more clear this is about cells to avoid confusion with rowEditStatus arguments?
export type CellEditStatus<Cell> = { pristine: Cell; isDirty: boolean }

export const setEditStatus = <Row>(
  editStatus: Partial<EditStatus<Row>>,
  editableRow: Editable<Row>,
): Editable<Row> => ({
  ...editableRow,
  [editableKey]: { ...editableRow[editableKey], ...editStatus },
})

// TODO: Explain: No constraints to object or Record<PropertyKey, unknown>. Doesn't add much, is more verbose, and
// Record causes issues with interfaces.
export type Editable<Row> = Row & { [editableKey]: EditStatus<Row> }

export const mkEditable = <Row>(row: Row): Editable<Row> => ({
  ...row,
  [editableKey]: { pristine: row, isDirty: false, isNew: false, isRemoved: false },
})

// Since editKey is not exported it cannot be in keyof Row, and `Omit<Editable<Row>, typeof editKey>` = `Row`, but
// TypeScript cannot infer this.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const stripEditable = <Row>({ [editableKey]: edit, ...row }: Editable<Row>): Row => row as unknown as Row

export const getEditStatus = <Row>(row: Editable<Row>): EditStatus<Row> => row[editableKey]

export const getPristineRow = <Row>(row: Editable<Row>): Row => row[editableKey].pristine

export const getIsDirty = <Row>(row: Editable<Row>): boolean => row[editableKey].isDirty

export const getIsNew = <Row>(row: Editable<Row>): boolean => row[editableKey].isNew

export const getIsRemoved = <Row>(row: Editable<Row>): boolean => row[editableKey].isRemoved

// Renderers

// TODO: Move these to EditableTable, once Columns type is split.
export type HeaderCellRenderer = (title?: string) => ReactElement

export type MetaCellRenderer<Row> = (row: Editable<Row>, editStatus: EditStatus<Row>) => ReactElement

export type CellRenderer<Row, ColumnKey extends keyof Row> = (
  cellState: StateRef<Row[ColumnKey]>,
  cellEditStatus: CellEditStatus<Row[ColumnKey]>,
  rowEditStatus: EditStatus<Row>,
) => ReactElement

export type RowRenderer<Row> = (renderedCells: ReactElement[], editStatus: EditStatus<Row>) => ReactElement

export type TableRenderer = (renderedHeaderCells: ReactElement[], renderedRows: ReactElement[]) => ReactElement

// Columns

// TODO: Split into simple type for useTableEditor and type with renderers for EditableTable

export type EditableColumn<Row, ColumnKey extends keyof Row> = {
  key: ColumnKey
  title?: string
  eq?: (pristine: Row[ColumnKey], current: Row[ColumnKey]) => boolean
  renderHeaderCell?: HeaderCellRenderer
  renderCell?: CellRenderer<Row, ColumnKey>
}

export const isEditableColumn = <Row>(column: Column<Row>): column is EditableColumn<Row, keyof Row> => 'key' in column

export const filterEditablecolumns = <Row>(columns: Column<Row>[]): EditableColumn<Row, keyof Row>[] =>
  columns.filter(isEditableColumn)

export type MetaColumn<Row> = {
  // A column that's not for editing a specific field, but for actions on the entire row, like remove, undo, etc.
  title?: string
  // renderHeaderCell gets the title as a prop, which may seem a bit odd. It can also be omitted and specified directly.
  renderHeaderCell?: HeaderCellRenderer
  renderMetaCell: MetaCellRenderer<Row>
}

export type Column<Row> = EditableColumn<Row, keyof Row> | MetaColumn<Row>

// Force distribution over row keys with a conditional type.
export type EditableColumnDist<Row, ColumnKey extends keyof Row> = ColumnKey extends keyof Row
  ? EditableColumn<Row, ColumnKey>
  : never

// To specify the columns, we export the type `Columns<Row>`, which distributes over the row keys:
//   (EditableColumn<Row, "key_1"> | .. | EditableColumn<Row, "key_n"> | MetaColumnConfig<Row>)[]
//
// This causes the types of eq and renderCell to be narrowed to each columns's cell type.
// Internally, we use the more general `Column<Row>[]` type: (EditableColumn<Row, keyof Row> | MetaColumnConfig<Row>)[]
export type Columns<Row> = (EditableColumnDist<Row, keyof Row> | MetaColumn<Row>)[]

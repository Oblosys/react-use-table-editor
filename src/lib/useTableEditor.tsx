import React, { ReactElement, useState } from 'react'

import * as utils from './utils'

export type StateRef<S> = [S, React.Dispatch<React.SetStateAction<S>>]

export type EditStatus<Row> = { pristine: Row; isDirty: boolean; isNew: boolean; isRemoved: boolean }
// TODO: Don't want isNew and isRemoved to both be true, enum is probably better. isNew || isRemoved imples isDirty.

// Cells cannot be added or removed, so we have a simpler edit status.
// TODO: Do we need to make it more clear this is about cells to avoid confusion with rowEditStatus arguments?
export type CellEditStatus<Cell> = { pristine: Cell; isDirty: boolean }

const setEditStatus = <Row,>(editStatus: Partial<EditStatus<Row>>, editableRow: Editable<Row>): Editable<Row> => ({
  ...editableRow,
  [editableKey]: { ...editableRow[editableKey], ...editStatus },
})

// Non-exported symbol to identify editable rows.
const editableKey = Symbol('editable')

// TODO: Explain: No constraints to object or Record<PropertyKey, unknown>. Doesn't add much, is more verbose, and
// Record causes issues with interfaces.
export type Editable<Row> = Row & {
  [editableKey]: EditStatus<Row>
}

const mkEditable = <Row,>(row: Row): Editable<Row> => ({
  ...row,
  [editableKey]: { pristine: row, isDirty: false, isNew: false, isRemoved: false },
})

// Since editKey is not exported it cannot be in keyof Row, and `Omit<Editable<Row>, typeof editKey>` = `Row`, but
// TypeScript cannot infer this.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const stripEditable = <Row,>({ [editableKey]: edit, ...row }: Editable<Row>): Row => row as unknown as Row

export const getPristineRow = <Row,>(row: Editable<Row>): Row => row[editableKey].pristine

export const getIsDirty = <Row,>(row: Editable<Row>): boolean => row[editableKey].isDirty

const getRowIdSet = <Row, RowIdKey extends keyof Row>(rowIdKey: RowIdKey, rows: Row[]): Set<Row[RowIdKey]> =>
  new Set(rows.map((row) => row[rowIdKey]))

type MetaCellRenderer<Row> = (row: Editable<Row>, editStatus: EditStatus<Row>) => ReactElement

type CellRenderer<Row, ColumnKey extends keyof Row> = (
  cellState: StateRef<Row[ColumnKey]>,
  cellEditStatus: CellEditStatus<Row[ColumnKey]>,
  rowEditStatus: EditStatus<Row>,
) => ReactElement

// defaultCellRenderer has type `CellRenderer<Row, ColumnKey extends keyof Row>` but TypeScript cannot express this.
const defaultCellRenderer = <Row, ColumnKey extends keyof Row>([cellValue]: StateRef<Row[ColumnKey]>): ReactElement => (
  <td>{'' + cellValue}</td>
)

type HeaderCellRenderer = (title?: string) => ReactElement

const defaultHeaderCellRenderer: HeaderCellRenderer = (title) => <th>{title}</th>

type RowRenderer<Row> = (renderedCells: ReactElement[], editStatus: EditStatus<Row>, pristineRow: Row) => ReactElement

const defaultRowRenderer: RowRenderer<unknown> = (renderedCells: ReactElement[]): ReactElement => (
  <tr>{renderedCells}</tr>
)

type TableRenderer = (renderedHeaderCells: ReactElement[], renderedRows: ReactElement[]) => ReactElement

const defaultTableRenderer: TableRenderer = (renderedHeaderCells, renderedRows) => (
  <table>
    <thead>
      <tr>{renderedHeaderCells}</tr>
    </thead>
    <tbody>{renderedRows}</tbody>
  </table>
)
type EditableColumn<Row, ColumnKey extends keyof Row> = {
  key: ColumnKey
  title: string
  eq?: (pristine: Row[ColumnKey], current: Row[ColumnKey]) => boolean
  renderHeaderCell?: HeaderCellRenderer
  renderCell?: CellRenderer<Row, ColumnKey>
}

const isEditableColumn = <Row,>(column: Column<Row>): column is EditableColumn<Row, keyof Row> => 'key' in column

const filterEditablecolumns = <Row,>(columns: Column<Row>[]): EditableColumn<Row, keyof Row>[] => {
  return columns.filter(isEditableColumn)
}

type MetaColumnConfig<Row> = {
  // A column that's not for a editing a specific field, but for actions on the row, like remove, undo, etc.
  title?: string
  // renderHeaderCell gets the title as a prop, which may seem a bit odd. It can also be omitted and specified directly.
  renderHeaderCell?: HeaderCellRenderer
  // isDirty is about the row, not the cell
  renderMetaCell: MetaCellRenderer<Row>
}

type Column<Row> = EditableColumn<Row, keyof Row> | MetaColumnConfig<Row>
type Columns<Row> = Column<Row>[]

// Force distribution over row keys.
type EditableColumnConfigDist<Row, ColumnKey extends keyof Row> = ColumnKey extends keyof Row
  ? EditableColumn<Row, ColumnKey>
  : never

// Distributed type, TODO: explain
type ColumnsProp<Row> = (EditableColumnConfigDist<Row, keyof Row> | MetaColumnConfig<Row>)[]

export type UpdateRowCell<Row> = <ColumnKey extends keyof Row>(
  columnKey: ColumnKey,
) => React.Dispatch<React.SetStateAction<Row[ColumnKey]>>

const renderEditableCell = <Row, ColumnKey extends keyof Row>(
  column: EditableColumn<Row, ColumnKey>,
  updateRowCell: UpdateRowCell<Row>,
  editableRow: Editable<Row>,
) => {
  const cellValue = editableRow[column.key]
  const updateCell = updateRowCell(column.key)
  const cellStateRef: StateRef<Row[ColumnKey]> = [cellValue, updateCell]
  const pristineValue = editableRow[editableKey].pristine[column.key]
  const isDirty = column.eq !== undefined ? !column.eq(cellValue, pristineValue) : cellValue !== pristineValue
  const cellEditStatus = { pristine: pristineValue, isDirty }

  const cellRenderer = column.renderCell ?? defaultCellRenderer
  return cellRenderer(cellStateRef, cellEditStatus, editableRow[editableKey])
}

const renderMetaCell = <Row,>(column: MetaColumnConfig<Row>, editableRow: Editable<Row>) =>
  column.renderMetaCell(editableRow, editableRow[editableKey])

// Custom equality

type EqualityByRowKey<Row> = {
  [K in keyof Row]?: EditableColumn<Row, K>['eq']
}

const getColEqualityByRowKey = <Row,>(columns: EditableColumn<Row, keyof Row>[]): EqualityByRowKey<Row> => {
  const columnRecord: EqualityByRowKey<Row> = {}
  for (const columnDistr of columns) {
    const column = columnDistr as EditableColumn<Row, keyof Row>
    columnRecord[column.key] = column.eq
  }
  return columnRecord
}

// Cell update

const applyCellUpdate = <S,>(prevState: S, update: React.SetStateAction<S>) =>
  typeof update === 'function' ? (update as (prevState: S) => S)(prevState) : update

const applyRowUpdate = <Row, ColumnKey extends keyof Row>(
  equalityByRowKey: EqualityByRowKey<Row>,
  previousEditableRow: Editable<Row>,
  columnKey: ColumnKey,
  update: React.SetStateAction<Row[ColumnKey]>,
): Editable<Row> => {
  // const { current: previousRow, [editableKey]: previousEditStatus } = previousEditableRow
  const previousRow = stripEditable(previousEditableRow)
  const pristine = previousEditableRow[editableKey].pristine
  const previousCellValue = previousRow[columnKey]
  const updatedCellValue = applyCellUpdate(previousCellValue, update)
  const updatedRow = { ...previousRow, [columnKey]: updatedCellValue }

  const rowKeys = Object.keys(updatedRow) as (keyof Row)[]
  const isDirty = rowKeys.some((key) => {
    const eq = equalityByRowKey[key]
    return eq !== undefined ? !eq(updatedRow[key], pristine[key]) : updatedRow[key] !== pristine[key]
  })

  const updatedEditStatus = { ...previousEditableRow[editableKey], isDirty }
  return { ...updatedRow, [editableKey]: updatedEditStatus }
}

const createMkUpdateRowByRowId =
  <Row, RowIdKey extends keyof Row>(
    rowIdKey: RowIdKey,
    setRows: React.Dispatch<React.SetStateAction<Editable<Row>[]>>,
  ) =>
  (equalityByRowKey: EqualityByRowKey<Row>) =>
  (rowId: Row[RowIdKey]): UpdateRowCell<Row> =>
  (columnKey) =>
  (update) =>
    setRows((rows) =>
      rows.map((row) => (row[rowIdKey] === rowId ? applyRowUpdate(equalityByRowKey, row, columnKey, update) : row)),
    )

// Components

type EditableCellProps<Row> = {
  column: Column<Row>
  editableRow: Editable<Row>
  updateRowCell: UpdateRowCell<Row>
}

const EditableCell = <Row,>({ column, editableRow, updateRowCell }: EditableCellProps<Row>): ReactElement =>
  isEditableColumn(column)
    ? renderEditableCell(column, updateRowCell, editableRow)
    : renderMetaCell(column, editableRow)

type EditableRowProps<Row> = {
  columns: Columns<Row>
  editableRow: Editable<Row>
  updateRowCell: UpdateRowCell<Row>
  renderRow?: RowRenderer<Row>
}

const EditableRow = <Row,>({
  columns,
  editableRow,
  updateRowCell,
  renderRow = defaultRowRenderer,
}: EditableRowProps<Row>) => {
  const cells = columns.map((column, index) => (
    <EditableCell key={`cell__${index}`} {...{ editableRow, updateRowCell, column }} />
  ))
  return renderRow(cells, editableRow[editableKey], editableRow[editableKey].pristine) // TODO: pristine is redundant now.
}

interface HeaderCellProps {
  title?: string
  renderHeaderCell?: HeaderCellRenderer
}

// Dummy component to easily pass the React key.
const HeaderCell = ({ title, renderHeaderCell }: HeaderCellProps) => {
  const headerCellRenderer = renderHeaderCell ?? defaultHeaderCellRenderer

  return headerCellRenderer(title)
}

type EditableTableProps<Row, RowIdKey extends keyof Row> = {
  className?: string
  rowIdKey: RowIdKey
  editableRows: Editable<Row>[]
  mkUpdateRowCellByRowId: (equalityByRowKey: EqualityByRowKey<Row>) => (rowKey: Row[RowIdKey]) => UpdateRowCell<Row>
  renderRow?: RowRenderer<Row>
  renderTable?: TableRenderer
  columns: ColumnsProp<Row>
}

export const EditableTable = <Row, RowIdKey extends keyof Row>({
  className,
  rowIdKey,
  editableRows,
  mkUpdateRowCellByRowId,
  renderRow,
  renderTable,
  columns,
}: EditableTableProps<Row, RowIdKey>): ReactElement => {
  const udateRowCellByRowId = mkUpdateRowCellByRowId(getColEqualityByRowKey(filterEditablecolumns(columns)))
  const renderedHeaderCells = columns.map((column, index) => (
    // Index keys are fine since columns are assumed to be constant.
    <HeaderCell key={index} title={column.title} renderHeaderCell={column.renderHeaderCell} />
  ))
  const renderedRows = editableRows.map((row) => {
    const key = '' + row[rowIdKey]
    return (
      <EditableRow<Row>
        columns={columns}
        key={key}
        editableRow={row}
        renderRow={renderRow}
        updateRowCell={udateRowCellByRowId(row[rowIdKey])}
      />
    )
  })
  const tableRenderer = renderTable ?? defaultTableRenderer
  const renderedTable = tableRenderer(renderedHeaderCells, renderedRows)

  return className === undefined ? renderedTable : React.cloneElement(renderedTable, { className: className })
}

// Table editing

const mkInitializeTable =
  <Row,>(setEditableRows: React.Dispatch<React.SetStateAction<Editable<Row>[]>>) =>
  (rows: Row[]) =>
    setEditableRows(rows.map((row) => mkEditable(row)))

export const mkInsertRows =
  <Row, RowIdKey extends keyof Row>(
    rowIdKey: RowIdKey, // TODO: use rowIdKey to check if row ids are not in editableRows already
    setEditableRows: React.Dispatch<React.SetStateAction<Editable<Row>[]>>,
  ) =>
  (rowsToInsert: Row[]): void =>
    setEditableRows((editableRows): Editable<Row>[] => [
      ...editableRows,
      ...rowsToInsert.map((row) => setEditStatus({ isNew: true }, mkEditable(row))),
    ])

const mkRemoveRows =
  <Row, RowIdKey extends keyof Row>(
    rowIdKey: RowIdKey,
    setEditableRows: React.Dispatch<React.SetStateAction<Editable<Row>[]>>,
  ) =>
  (rowsToRemove: Row[]) => {
    const rowIdSetToRemove = getRowIdSet<Row, RowIdKey>(rowIdKey, rowsToRemove)

    setEditableRows((editableRows): Editable<Row>[] =>
      editableRows
        .map((editableRow) =>
          rowIdSetToRemove.has(editableRow[rowIdKey])
            ? editableRow[editableKey].isNew
              ? null // Removing a new row removes it, rather than setting isRemoved.
              : setEditStatus({ isRemoved: true }, editableRow)
            : editableRow,
        )
        .filter(utils.isDefined),
    )
  }

// NOTE: Revert on a removed row both unremoves it and undoes any cell changes.
const mkRevertRows =
  <Row, RowIdKey extends keyof Row>(
    rowIdKey: RowIdKey,
    setEditableRows: React.Dispatch<React.SetStateAction<Editable<Row>[]>>,
  ) =>
  (rowsToRevert: Row[]) => {
    const rowIdSetToRevert = getRowIdSet<Row, RowIdKey>(rowIdKey, rowsToRevert)

    setEditableRows((editableRows): Editable<Row>[] =>
      editableRows
        .map((editableRow) =>
          rowIdSetToRevert.has(editableRow[rowIdKey])
            ? editableRow[editableKey].isNew
              ? null // Reverting a new row removes it.
              : mkEditable(editableRow[editableKey].pristine)
            : editableRow,
        )
        .filter(utils.isDefined),
    )
  }

const mkCommitRows =
  <Row, RowIdKey extends keyof Row>(
    rowIdKey: RowIdKey,
    setEditableRows: React.Dispatch<React.SetStateAction<Editable<Row>[]>>,
  ) =>
  (rowsToCommit: Row[]) => {
    const rowIdSetToCommit = getRowIdSet<Row, RowIdKey>(rowIdKey, rowsToCommit)

    setEditableRows((editableRows): Editable<Row>[] =>
      editableRows
        .map((editableRow) =>
          rowIdSetToCommit.has(editableRow[rowIdKey])
            ? editableRow[editableKey].isRemoved
              ? null // Committing a removed row removes it.
              : mkEditable(stripEditable(editableRow))
            : editableRow,
        )
        .filter(utils.isDefined),
    )
  }

// Hook

type UseTableEditor<Row, RowIdKey extends keyof Row> = {
  rows: {
    current: Row[]
    pristine: Row[]
    dirty: Editable<Row>[]
    removed: Editable<Row>[]
    new: Editable<Row>[]
  }
  edit: {
    initializeTable: (rows: Row[]) => void
    insertRows: (rows: Row[]) => void
    removeRows: (rows: Row[]) => void
    commitRows: (rows: Row[]) => void
    revertRows: (rows: Row[]) => void
  }
  prim: {
    editableRows: Editable<Row>[]
    mkUpdateRowCellByRowId: (equalityByRowKey: EqualityByRowKey<Row>) => (rowKey: Row[RowIdKey]) => UpdateRowCell<Row>
  }
}

export const useTableEditor = <Row, RowIdKey extends keyof Row>(
  rowIdKey: RowIdKey,
  initialRows: Row[],
): UseTableEditor<Row, RowIdKey> => {
  const state = useState<Editable<Row>[]>(initialRows.map(mkEditable))
  const [editableRows, setEditableRows] = state

  // TODO: Memoize
  const rows = {
    current: editableRows
      .filter((editableRow) => !editableRow[editableKey].isRemoved)
      .map((editableRow) => stripEditable(editableRow)),
    pristine: editableRows
      .filter((editableRow) => !editableRow[editableKey].isNew)
      .map((editableRow) => editableRow[editableKey].pristine),
    dirty: editableRows.filter(
      (editableRow) =>
        editableRow[editableKey].isDirty || editableRow[editableKey].isRemoved || editableRow[editableKey].isNew,
    ),
    removed: editableRows.filter((editableRow) => editableRow[editableKey].isRemoved),
    new: editableRows.filter((editableRow) => editableRow[editableKey].isNew),
  }
  const edit = {
    initializeTable: mkInitializeTable(setEditableRows),
    insertRows: mkInsertRows(rowIdKey, setEditableRows),
    removeRows: mkRemoveRows(rowIdKey, setEditableRows),
    revertRows: mkRevertRows(rowIdKey, setEditableRows),
    commitRows: mkCommitRows(rowIdKey, setEditableRows),
  }
  const prim = {
    editableRows,
    mkUpdateRowCellByRowId: createMkUpdateRowByRowId(rowIdKey, setEditableRows),
  }
  return { rows, edit, prim }
}

// Exported utils

export const getEditStatusClassName = ({ isDirty, isNew, isRemoved }: EditStatus<unknown>): string =>
  [isDirty ? 'is-dirty' : '', isNew ? 'is-new' : '', isRemoved ? 'is-removed' : ''].join(' ')

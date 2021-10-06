import React, { ReactElement, useState } from 'react'

export type StateRef<S> = [S, React.Dispatch<React.SetStateAction<S>>]

export type EditStatus = { isDirty: boolean; isNew: boolean; isRemoved: boolean }
// TODO: Don't want isNew and isRemoved to be both true, enum is probably better. isNew & isRemoved imply isDirty.

const setEditStatus = <Row,>(editStatus: Partial<EditStatus>, editableRow: Editable<Row>): Editable<Row> => ({
  ...editableRow,
  editStatus: { ...editableRow.editStatus, ...editStatus },
})

// Non-exported symbol to identify editable rows.
const editableSymbol = Symbol('editable')

// TODO: Explain: No constraints to object or Record<PropertyKey, unknown>. Doesn't add much, is more verbose, and
// Record causes issues with interfaces.
export type Editable<Row> = {
  [editableSymbol]: null
  current: Row
  pristine: Row
  editStatus: EditStatus
}

const mkEditable = <Row,>(row: Row): Editable<Row> => ({
  [editableSymbol]: null,
  current: row,
  pristine: row,
  editStatus: { isDirty: false, isNew: false, isRemoved: false },
})

const isEditableRow = <Row,>(row: Row | Editable<Row>): row is Editable<Row> => editableSymbol in row

type CellRenderer<Row, ColumnKey extends keyof Row> = (
  cellState: StateRef<Row[ColumnKey]>,
  isDirty: boolean,
  pristineValue: Row[ColumnKey],
) => ReactElement

// defaultCellRenderer has type `CellRenderer<Row, ColumnKey extends keyof Row>` but TypeScript cannot express this.
const defaultCellRenderer = <Row, ColumnKey extends keyof Row>([cellValue]: StateRef<Row[ColumnKey]>): ReactElement => (
  <td>{'' + cellValue}</td>
)

type HeaderCellRenderer = (title?: string) => ReactElement

const defaultHeaderCellRenderer: HeaderCellRenderer = (title) => <th>{title}</th>

type RowRenderer<Row> = (renderedCells: ReactElement[], editStatus: EditStatus, pristineRow: Row) => ReactElement

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
  renderMetaCell: (row: Editable<Row>, editStatus: EditStatus) => ReactElement
}

type Column<Row> = EditableColumn<Row, keyof Row> | MetaColumnConfig<Row>
type Columns<Row> = Column<Row>[]

// Force distribution over row keys.
type EditableColumnConfigDist<Row, ColumnKey extends keyof Row> = ColumnKey extends keyof Row
  ? EditableColumn<Row, ColumnKey>
  : never

// Distributed type, TODO: explain
type ColumnsProp<Row> = (EditableColumnConfigDist<Row, keyof Row> | MetaColumnConfig<Row>)[]

type UpdateRowCell<Row, ColumnKey extends keyof Row> = (
  columnKey: ColumnKey,
) => React.Dispatch<React.SetStateAction<Row[ColumnKey]>>

const renderEditableCell = <Row, ColumnKey extends keyof Row>(
  column: EditableColumn<Row, ColumnKey>,
  updateRowCell: UpdateRowCell<Row, ColumnKey>,
  editableRow: Editable<Row>,
) => {
  const cellValue = editableRow.current[column.key]
  const updateCell = updateRowCell(column.key)
  const cellStateRef: StateRef<Row[ColumnKey]> = [cellValue, updateCell]
  const pristineValue = editableRow.pristine[column.key]
  const isDirty = column.eq !== undefined ? !column.eq(cellValue, pristineValue) : cellValue !== pristineValue

  const cellRenderer = column.renderCell ?? defaultCellRenderer
  return cellRenderer(cellStateRef, isDirty, pristineValue)
}

const renderMetaCell = <Row,>(column: MetaColumnConfig<Row>, editableRow: Editable<Row>) =>
  column.renderMetaCell(editableRow, editableRow.editStatus)

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

const applyCellUpdate = <S,>(prevState: S, update: React.SetStateAction<S>) =>
  typeof update === 'function' ? (update as (prevState: S) => S)(prevState) : update

const applyRowUpdate = <Row, ColumnKey extends keyof Row>(
  equalityByRowKey: EqualityByRowKey<Row>,
  previousEditableRow: Editable<Row>,
  columnKey: ColumnKey,
  update: React.SetStateAction<Row[ColumnKey]>,
): Editable<Row> => {
  const { current: previousRow, pristine, editStatus: previousEditStatus } = previousEditableRow
  const previousCellValue = previousRow[columnKey]
  const updatedCellValue = applyCellUpdate(previousCellValue, update)
  const updatedRow = { ...previousRow, [columnKey]: updatedCellValue }

  const rowKeys = Object.keys(updatedRow) as (keyof Row)[]
  const isDirty = rowKeys.some((key) => {
    const eq = equalityByRowKey[key]
    return eq !== undefined ? !eq(updatedRow[key], pristine[key]) : updatedRow[key] !== pristine[key]
  })

  const updatedEditStatus = { ...previousEditStatus, isDirty }
  return { ...previousEditableRow, current: updatedRow, editStatus: updatedEditStatus }
}

const createMkUpdateRowByRowId =
  <Row, RowIdKey extends keyof Row, ColumnKey extends keyof Row>(
    rowIdKey: RowIdKey,
    setRows: React.Dispatch<React.SetStateAction<Editable<Row>[]>>,
  ) =>
  (equalityByRowKey: EqualityByRowKey<Row>) =>
  (rowId: Row[RowIdKey]) =>
  (columnKey: ColumnKey): React.Dispatch<React.SetStateAction<Row[ColumnKey]>> =>
  (update: React.SetStateAction<Row[ColumnKey]>): void =>
    setRows((rows) =>
      rows.map((row) =>
        row.current[rowIdKey] === rowId ? applyRowUpdate(equalityByRowKey, row, columnKey, update) : row,
      ),
    )

// Components

type EditableCellProps<Row> = {
  column: Column<Row>
  editableRow: Editable<Row>
  updateRowCell: UpdateRowCell<Row, keyof Row>
}

const EditableCell = <Row,>({ column, editableRow, updateRowCell }: EditableCellProps<Row>): ReactElement =>
  isEditableColumn(column)
    ? renderEditableCell(column, updateRowCell, editableRow)
    : renderMetaCell(column, editableRow)

type EditableRowProps<Row> = {
  columns: Columns<Row>
  editableRow: Editable<Row>
  updateRowCell: UpdateRowCell<Row, keyof Row>
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
  return renderRow(cells, editableRow.editStatus, editableRow.pristine)
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
  mkUpdateRowCellByRowId: (
    equalityByRowKey: EqualityByRowKey<Row>,
  ) => (rowKey: Row[RowIdKey]) => UpdateRowCell<Row, keyof Row>
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
    const key = '' + row.current[rowIdKey]
    return (
      <EditableRow<Row>
        columns={columns}
        key={key}
        editableRow={row}
        renderRow={renderRow}
        updateRowCell={udateRowCellByRowId(row.current[rowIdKey])}
      />
    )
  })
  const tableRenderer = renderTable ?? defaultTableRenderer
  const renderedTable = tableRenderer(renderedHeaderCells, renderedRows)

  return className === undefined ? renderedTable : React.cloneElement(renderedTable, { className: className })
}

// Table editing

// TODO: All of these need tests
// TODO: Log warnings on invalid use.

const mkInitializeTable =
  <Row,>(setEditableRows: React.Dispatch<React.SetStateAction<Editable<Row>[]>>) =>
  (rows: Row[]) =>
    setEditableRows(rows.map((row) => mkEditable(row)))

const getRowId = <Row, RowIdKey extends keyof Row>(rowIdKey: RowIdKey, row: Row | Editable<Row>) =>
  isEditableRow(row) ? row.current[rowIdKey] : row[rowIdKey]

const getRowIdSet = <Row, RowIdKey extends keyof Row>(
  rowIdKey: RowIdKey,
  rows: Row[] | Editable<Row>[],
): Set<Row[RowIdKey]> => new Set(rows.map((row) => getRowId(rowIdKey, row)))

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
  (rowsToRemove: Row[] | Editable<Row>[]) => {
    const rowIdSetToRemove = getRowIdSet<Row, RowIdKey>(rowIdKey, rowsToRemove)

    setEditableRows((editableRows): Editable<Row>[] =>
      editableRows.flatMap((editableRow) =>
        rowIdSetToRemove.has(editableRow.current[rowIdKey])
          ? editableRow.editStatus.isNew
            ? [] // Revert removes new rows
            : [setEditStatus({ isRemoved: true }, editableRow)]
          : [editableRow],
      ),
    )
  }

// NOTE: Revert on a removed row both unremoves it and undoes any cell changes.
const mkRevertRows =
  <Row, RowIdKey extends keyof Row>(
    rowIdKey: RowIdKey,
    setEditableRows: React.Dispatch<React.SetStateAction<Editable<Row>[]>>,
  ) =>
  (rowsToRevert: Row[] | Editable<Row>[]) => {
    const rowIdSetToRevert = getRowIdSet<Row, RowIdKey>(rowIdKey, rowsToRevert)

    setEditableRows((editableRows): Editable<Row>[] =>
      editableRows.flatMap((editableRow) =>
        rowIdSetToRevert.has(editableRow.current[rowIdKey])
          ? editableRow.editStatus.isNew
            ? [] // Revert removes new rows.
            : [mkEditable(editableRow.pristine)]
          : [editableRow],
      ),
    )
  }

const mkCommitRows =
  <Row, RowIdKey extends keyof Row>(
    rowIdKey: RowIdKey,
    setEditableRows: React.Dispatch<React.SetStateAction<Editable<Row>[]>>,
  ) =>
  (rowsToCommit: Row[] | Editable<Row>[]) => {
    const rowIdSetToCommit = getRowIdSet<Row, RowIdKey>(rowIdKey, rowsToCommit)

    setEditableRows((editableRows): Editable<Row>[] =>
      editableRows.flatMap((editableRow) =>
        rowIdSetToCommit.has(editableRow.current[rowIdKey])
          ? editableRow.editStatus.isRemoved
            ? [] // Commit removes removed rows.
            : [mkEditable(editableRow.current)]
          : [editableRow],
      ),
    )
  }

// Hook

type UseEditableTable<Row, RowIdKey extends keyof Row> = {
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
    removeRows: (rows: Row[] | Editable<Row>[]) => void
    commitRows: (rows: Row[] | Editable<Row>[]) => void
    revertRows: (rows: Row[] | Editable<Row>[]) => void
  }
  prim: {
    editableRows: Editable<Row>[]
    mkUpdateRowCellByRowId: (
      equalityByRowKey: EqualityByRowKey<Row>,
    ) => (rowKey: Row[RowIdKey]) => UpdateRowCell<Row, keyof Row>
  }
}

export const useEditableTable = <Row, RowIdKey extends keyof Row>(
  rowIdKey: RowIdKey,
  initialRows: Row[],
): UseEditableTable<Row, RowIdKey> => {
  const state = useState<Editable<Row>[]>(initialRows.map(mkEditable))
  const [editableRows, setEditableRows] = state

  // TODO: Memoize
  const rows = {
    current: editableRows
      .filter((editableRow) => !editableRow.editStatus.isRemoved)
      .map((editableRow) => editableRow.current),
    pristine: editableRows
      .filter((editableRow) => !editableRow.editStatus.isNew)
      .map((editableRow) => editableRow.pristine),
    dirty: editableRows.filter(
      (editableRow) =>
        editableRow.editStatus.isDirty || editableRow.editStatus.isRemoved || editableRow.editStatus.isNew,
    ),
    removed: editableRows.filter((editableRow) => editableRow.editStatus.isRemoved),
    new: editableRows.filter((editableRow) => editableRow.editStatus.isNew),
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

// Utils

export const getEditStatusClassName = ({ isDirty, isNew, isRemoved }: EditStatus): string =>
  [isDirty ? 'is-dirty' : '', isNew ? 'is-new' : '', isRemoved ? 'is-removed' : ''].join(' ')

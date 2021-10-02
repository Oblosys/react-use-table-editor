import React, { useState } from 'react'

export type StateRef<S> = [S, React.Dispatch<React.SetStateAction<S>>]

export type Editable<Row> = { current: Row; pristine: Row; isDirty: boolean }

const mkEditable = <Row,>(row: Row): Editable<Row> => ({
  current: row,
  pristine: row,
  isDirty: false,
})

type EditableColumn<Row, ColumnKey extends keyof Row> = {
  key: ColumnKey
  title: string
  thClassName?: string
  tdClassName?: string
  renderCell: (cellState: StateRef<Row[ColumnKey]>, isDirty: boolean) => React.ReactNode
}

const isEditableColumn = <Row,>(column: Column<Row>): column is EditableColumn<Row, keyof Row> => 'renderCell' in column

type MetaColumnConfig<Row> = {
  // A column that's not for a editing a specific field, but for actions on the row, like delete, undo, etc.
  title?: string
  thClassName?: string
  tdClassName?: string
  // isDirty is about the row, not the cell
  renderMetaCell: (row: Editable<Row>, isDirty: boolean) => React.ReactNode
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
  const isDirty = cellValue !== pristineValue

  return column.renderCell(cellStateRef, isDirty)
}

const renderMetaCell = <Row,>(column: MetaColumnConfig<Row>, editableRow: Editable<Row>) =>
  column.renderMetaCell(editableRow, editableRow.isDirty)

type EditableCellProps<Row> = {
  column: Column<Row>
  editableRow: Editable<Row>
  updateRowCell: UpdateRowCell<Row, keyof Row>
}

const EditableCell = <Row,>({ column, editableRow, updateRowCell }: EditableCellProps<Row>): JSX.Element => (
  <td className={column.tdClassName}>
    {isEditableColumn(column)
      ? renderEditableCell(column, updateRowCell, editableRow)
      : renderMetaCell(column, editableRow)}
  </td>
)

type EditableRowProps<Row> = {
  columns: Columns<Row>
  editableRow: Editable<Row>
  updateRowCell: UpdateRowCell<Row, keyof Row>
}

const EditableRow = <Row,>({ columns, editableRow, updateRowCell }: EditableRowProps<Row>) => {
  const cells = columns.map((column, index) => (
    <EditableCell key={`cell__${index}`} {...{ editableRow, updateRowCell, column }} />
  ))
  return <tr>{cells}</tr>
}

type EditableTableProps<Row, RowIdKey extends keyof Row> = {
  className?: string
  rowIdKey: RowIdKey
  columns: ColumnsProp<Row>
  editableRows: Editable<Row>[]
  updateRowCellByKey: (rowKey: Row[RowIdKey]) => UpdateRowCell<Row, keyof Row>
}

export const EditableTable = <Row, RowIdKey extends keyof Row>({
  className,
  rowIdKey,
  columns,
  editableRows,
  updateRowCellByKey,
}: EditableTableProps<Row, RowIdKey>): JSX.Element => (
  <table className={className}>
    <thead>
      <tr>
        {columns.map((column, index) => (
          <th key={`${column.title}__${index}`} className={column.thClassName}>
            {column.title ?? ''}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {editableRows.map((row) => {
        const key = '' + row.current[rowIdKey]
        return (
          <EditableRow<Row>
            columns={columns}
            key={key}
            editableRow={row}
            updateRowCell={updateRowCellByKey(row.current[rowIdKey])}
          />
        )
      })}
    </tbody>
  </table>
)

const applyCellUpdate = <S,>(prevState: S, update: React.SetStateAction<S>) =>
  typeof update === 'function' ? (update as (prevState: S) => S)(prevState) : update

const applyRowUpdate = <Row, ColumnKey extends keyof Row>(
  previousEditableRow: Editable<Row>,
  columnKey: ColumnKey,
  update: React.SetStateAction<Row[ColumnKey]>,
): Editable<Row> => {
  const previousRow = previousEditableRow.current
  const previousCellValue = previousEditableRow.current[columnKey]
  const newCellValue = applyCellUpdate(previousCellValue, update)
  const newRow = { ...previousRow, [columnKey]: newCellValue }
  const rowKeys = Object.keys(newRow) as (keyof Row)[]
  const isDirty = rowKeys.some((key) => newRow[key] !== previousEditableRow.pristine[key])

  return { ...previousEditableRow, current: newRow, isDirty }
}

const createUpdateRowByRowId =
  <Row, RowIdKey extends keyof Row, ColumnKey extends keyof Row>(
    rowIdKey: RowIdKey,
    setRows: React.Dispatch<React.SetStateAction<Editable<Row>[]>>,
  ) =>
  (rowId: Row[RowIdKey]) =>
  (columnKey: ColumnKey): React.Dispatch<React.SetStateAction<Row[ColumnKey]>> =>
  (update: React.SetStateAction<Row[ColumnKey]>): void =>
    setRows((rows) =>
      rows.map((row) => (row.current[rowIdKey] === rowId ? applyRowUpdate(row, columnKey, update) : row)),
    )

export const useEditableRows = <Row, RowIdKey extends keyof Row>(
  rowIdKey: RowIdKey,
  rows: Row[],
): {
  state: [Editable<Row>[], React.Dispatch<React.SetStateAction<Editable<Row>[]>>]
  setRows: (rows: Row[]) => void
  updateRowCellByRowId: (rowKey: Row[RowIdKey]) => UpdateRowCell<Row, keyof Row>
  dirtyRows: Editable<Row>[]
} => {
  const state = useState<Editable<Row>[]>(rows.map(mkEditable))
  const [editableRows, setEditableRows] = state

  const setRows = (rows: Row[]) =>
    setEditableRows((editableRows) => {
      // TODO: Explain
      const editableRowIds = new Set(editableRows.map((row) => row.current[rowIdKey]))
      const rowIds = new Set(rows.map((row) => row[rowIdKey]))
      const newRowIds = new Set(Array.from(rowIds).filter((id) => !editableRowIds.has(id)))
      const existingRowMap = new Map(
        rows.filter(({ [rowIdKey]: id }) => editableRowIds.has(id)).map((row) => [row[rowIdKey], row]),
      )
      const newRows = rows.filter(({ [rowIdKey]: id }) => newRowIds.has(id)).map(mkEditable)
      return [
        ...editableRows.map((editableRow) => {
          const existingRow = existingRowMap.get(editableRow.current[rowIdKey])
          return existingRow !== undefined ? mkEditable(existingRow) : editableRow
        }),
        ...newRows,
      ]
    })
  const updateRowCellByRowId = createUpdateRowByRowId(rowIdKey, setEditableRows)
  const dirtyRows = editableRows.filter((row) => row.isDirty)

  return { state, setRows, updateRowCellByRowId, dirtyRows }
}
// TODO: Also add a setAll? Or a clear?

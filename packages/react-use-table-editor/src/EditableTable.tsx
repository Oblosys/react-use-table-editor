import React, { ReactElement } from 'react'

import {
  Column,
  Editable,
  EditableColumn,
  HeaderCellRenderer,
  MetaColumn,
  RowRenderer,
  StateRef,
  TableRenderer,
  getEditStatus,
  getPristineRow,
  isEditableColumn,
} from './editable'

// defaultCellRenderer has type `CellRenderer<Row, ColumnKey extends keyof Row>` but TypeScript cannot express this.
const defaultCellRenderer = <Row, ColumnKey extends keyof Row>([cellValue]: StateRef<Row[ColumnKey]>): ReactElement => (
  <td>{'' + cellValue}</td>
)

const defaultHeaderCellRenderer: HeaderCellRenderer = (title) => <th>{title}</th>

const defaultRowRenderer: RowRenderer<unknown> = (renderedCells: ReactElement[]): ReactElement => (
  <tr>{renderedCells}</tr>
)

const defaultTableRenderer: TableRenderer = (renderedHeaderCells, renderedRows) => (
  <table>
    <thead>
      <tr>{renderedHeaderCells}</tr>
    </thead>
    <tbody>{renderedRows}</tbody>
  </table>
)

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
  const pristineValue = getPristineRow(editableRow)[column.key]
  const isDirty = column.eq !== undefined ? !column.eq(cellValue, pristineValue) : cellValue !== pristineValue
  const cellEditStatus = { pristine: pristineValue, isDirty }

  const cellRenderer = column.renderCell ?? defaultCellRenderer
  return cellRenderer(cellStateRef, cellEditStatus, getEditStatus(editableRow))
}

const renderMetaCell = <Row,>(column: MetaColumn<Row>, editableRow: Editable<Row>) =>
  column.renderMetaCell(editableRow, getEditStatus(editableRow))

// Curried updater for cells, to be used in table component.

const applyCellUpdate = <S,>(prevState: S, update: React.SetStateAction<S>) =>
  typeof update === 'function' ? (update as (prevState: S) => S)(prevState) : update

export const createMkUpdateRowCellByRowId =
  <Row, RowIdKey extends keyof Row>(updateRow: (rowUpdate: (prev: Row) => Row, rowIdToUpdate: Row[RowIdKey]) => void) =>
  (rowId: Row[RowIdKey]): UpdateRowCell<Row> =>
  (columnKey) =>
  (update) => {
    updateRow(
      (previousRow) => ({
        ...previousRow,
        [columnKey]: applyCellUpdate(previousRow[columnKey], update),
      }),
      rowId,
    )
  }

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
  columns: Column<Row>[]
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
  return renderRow(cells, getEditStatus(editableRow))
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
  updateRow: (rowUpdate: (prev: Row) => Row, row: Row | Row[RowIdKey]) => void
  renderRow?: RowRenderer<Row>
  renderTable?: TableRenderer
  columns: Column<Row>[] // Column<Row>[] instead of Columns<Row> as it is easier to use and EditableRow is internal.
}

export const EditableTable = <Row, RowIdKey extends keyof Row>({
  className,
  rowIdKey,
  editableRows,
  updateRow,
  renderRow,
  renderTable,
  columns,
}: EditableTableProps<Row, RowIdKey>): ReactElement => {
  const updateRowCellByRowId = createMkUpdateRowCellByRowId<Row, RowIdKey>(updateRow)

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
        updateRowCell={updateRowCellByRowId(row[rowIdKey])}
      />
    )
  })
  const tableRenderer = renderTable ?? defaultTableRenderer
  const renderedTable = tableRenderer(renderedHeaderCells, renderedRows)

  return className === undefined ? renderedTable : React.cloneElement(renderedTable, { className: className })
}

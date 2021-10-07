import { Column } from 'material-table'

import { Editable, getPristineRow, stripEditable, useEditableTable } from '../lib/EditableTable'

const getDirtyCellStyle =
  <Row>(cellKey: keyof Row) =>
  (data: unknown, rowData: Editable<Row>): React.CSSProperties => {
    // We'll just index directly // columnDef.field, but that would require an extra type parameter for Column<RowData>. // Argument type of `data` is wrong, should be RowData[keyof RowData] instead of RowData[], or even the same as
    if (!rowData) {
      console.log('rowData undefined')
      return {}
    }
    return rowData[cellKey] !== getPristineRow(rowData)[cellKey] ? { backgroundColor: '#dce4ff' } : {}
  }

export const setDirtyCellStyleProperty = <Row>(columnDef: Column<Editable<Row>>): Column<Editable<Row>> =>
  columnDef.field !== undefined
    ? {
        ...columnDef,
        cellStyle: getDirtyCellStyle(columnDef.field as keyof Row), // field is not strongly typed
      }
    : columnDef

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const useMaterialTableEditor = <Row, RowIdKey extends keyof Row>(rowIdKey: RowIdKey, initialRows: Row[]) => {
  const {
    edit,
    prim: { editableRows, mkUpdateRowCellByRowId },
  } = useEditableTable(rowIdKey, initialRows)

  const rows = editableRows
  const asyncInsertRow = async (newRow: Row) => {
    console.log('inserting', newRow)
    edit.insertRows([newRow])
  }
  const asyncRemoveRow = async (oldRow: Editable<Row>) => edit.removeRows([oldRow])
  const asyncUpdateCell = async <CellKey extends keyof Row>(
    newValue: Row[CellKey],
    oldValue: Row[CellKey],
    row: Editable<Row>,
    columnDef: Column<Editable<Row>>,
  ) => mkUpdateRowCellByRowId({})(row[rowIdKey])(columnDef.field as keyof Row)(newValue)

  const asyncUpdateRow = async (newEditableRow: Editable<Row>, previousEditableRow?: Editable<Row>) => {
    console.log('', newEditableRow)
    const newRow = stripEditable(newEditableRow)
    const previousRow = previousEditableRow !== undefined ? stripEditable(previousEditableRow) : undefined
    console.log(newRow)

    const updateRowCell = mkUpdateRowCellByRowId({})(newRow[rowIdKey])
    const rowKeys = Object.keys(newRow) as (keyof Row)[]
    rowKeys.forEach((key) => {
      console.log(key)
      // TODO: also ignore editStatus keys
      // TODO: parameterize with id key
      if (key !== 'username' && newRow[key] !== previousRow?.[key]) {
        console.log('setting', key, newRow[key])
        updateRowCell(key)(newRow[key])
      }
    })
  }

  return {
    rows,
    edit: { asyncInsertRow, asyncRemoveRow, asyncUpdateCell, asyncUpdateRow },
  }
}

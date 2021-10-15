import React, { useState } from 'react'

import {
  Column,
  Columns,
  EditStatus,
  Editable,
  EditableColumn,
  filterEditablecolumns,
  getEditStatus,
  mkEditable,
  setEditStatus,
  stripEditable,
} from './editable'
import { editableKey } from './editableKey'
import * as utils from './utils'

const getRowIdSet = <Row, RowIdKey extends keyof Row>(rowIdKey: RowIdKey, rows: Row[]): Set<Row[RowIdKey]> =>
  new Set(rows.map((row) => row[rowIdKey]))

// Custom equality

type EqualityByRowKey<Row> = {
  [K in keyof Row]?: EditableColumn<Row, K>['eq']
}

const getEqualityByRowKey = <Row>(columns: EditableColumn<Row, keyof Row>[]): EqualityByRowKey<Row> => {
  const equalityByRowKey: EqualityByRowKey<Row> = {}
  for (const column of columns) {
    equalityByRowKey[column.key] = column.eq
  }
  return equalityByRowKey
}

// Cell update

const computeIsDirty = <Row>(
  editableRowKeys: (keyof Row)[],
  equalityByRowKey: EqualityByRowKey<Row>,
  pristine: Row,
  row: Row,
): boolean =>
  editableRowKeys.some((key) => {
    const eq = equalityByRowKey[key] ?? ((c1, c2) => c1 === c2)
    return !eq(row[key], pristine[key])
  })

const applyRowUpdate = <Row>(
  editableRowKeys: (keyof Row)[],
  equalityByRowKey: EqualityByRowKey<Row>,
  rowUpdate: (prev: Row) => Row,
  editableRow: Editable<Row>,
): Editable<Row> => {
  const editStatus = getEditStatus(editableRow)
  const updatedRow = rowUpdate(stripEditable(editableRow))
  const updatedEditStatus = {
    ...editStatus,
    isDirty: computeIsDirty(editableRowKeys, equalityByRowKey, editStatus.pristine, updatedRow),
  }
  return { ...updatedRow, [editableKey]: updatedEditStatus }
}

// Apply rowUpdate to row with id rowID, and set isDirty on the updated editable row.
export const applyRowUpdateByRowId =
  <Row, RowIdKey extends keyof Row>(
    rowIdKey: RowIdKey,
    editableRowKeys: (keyof Row)[],
    equalityByRowKey: EqualityByRowKey<Row>,
    rowId: Row[RowIdKey],
    rowUpdate: (prev: Row) => Row,
  ) =>
  (editableRows: Editable<Row>[]): Editable<Row>[] => {
    const rowIndex = editableRows.findIndex((row) => row[rowIdKey] === rowId)
    if (rowIndex === -1) {
      throw new Error(`applyRowUpdateByRowId: update on non-existent row id ${rowId}`)
    }
    const editableRowToUpdate = applyRowUpdate(editableRowKeys, equalityByRowKey, rowUpdate, editableRows[rowIndex])
    const leadingRows = editableRows.slice(0, rowIndex)
    const trailingRows = editableRows.slice(rowIndex + 1)
    return [...leadingRows, editableRowToUpdate, ...trailingRows]
  }

// Table editing

const mkInitializeTable =
  <Row>(setEditableRows: React.Dispatch<React.SetStateAction<Editable<Row>[]>>) =>
  (rows: Row[]) =>
    setEditableRows(rows.map((row) => mkEditable(row)))

export const mkInsertRows =
  <Row, RowIdKey extends keyof Row>(
    rowIdKey: RowIdKey, // TODO: use rowIdKey to check if row ids are not in editableRows already
    setEditableRows: React.Dispatch<React.SetStateAction<Editable<Row>[]>>,
  ) =>
  (rowsToInsert: Row[]): void =>
    setEditableRows((editableRows) => [
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

    setEditableRows((editableRows) =>
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

    setEditableRows((editableRows) =>
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

    setEditableRows((editableRows) =>
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

const isRow = <Row, RowIdKey extends keyof Row>(rowIdKey: RowIdKey, rowOrId: Row | Row[RowIdKey]): rowOrId is Row =>
  typeof rowOrId === 'object' && rowIdKey in rowOrId

const mkUpdateRow =
  <Row, RowIdKey extends keyof Row>(
    rowIdKey: RowIdKey,
    editableRowKeys: (keyof Row)[],
    equalityByRowKey: EqualityByRowKey<Row>,
    setEditableRows: React.Dispatch<React.SetStateAction<Editable<Row>[]>>,
  ) =>
  (rowUpdate: (prev: Row) => Row, rowOrIdToUpdate: Row | Row[RowIdKey]) => {
    const rowIdToUpdate = isRow(rowIdKey, rowOrIdToUpdate) ? rowOrIdToUpdate[rowIdKey] : rowOrIdToUpdate
    const stateUpdate = applyRowUpdateByRowId<Row, RowIdKey>(
      rowIdKey,
      editableRowKeys,
      equalityByRowKey,
      rowIdToUpdate,
      rowUpdate,
    )
    setEditableRows(stateUpdate)
  }

// Hook

export type UseTableEditor<Row, RowIdKey extends keyof Row> = {
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
    updateRow: (rowUpdate: (prev: Row) => Row, row: Row | Row[RowIdKey]) => void
  }
  prim: {
    editableRows: Editable<Row>[]
    columns: Column<Row>[]
  }
}

export const useTableEditor = <Row, RowIdKey extends keyof Row>(
  rowIdKey: RowIdKey,
  columns: Columns<Row>,
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

  const editableColumns = filterEditablecolumns(columns)
  const equalityByRowKey = getEqualityByRowKey(editableColumns)
  const editableRowKeys = editableColumns.map((column) => column.key)
  const updateRow = mkUpdateRow(rowIdKey, editableRowKeys, equalityByRowKey, setEditableRows)

  const edit = {
    initializeTable: mkInitializeTable(setEditableRows),
    insertRows: mkInsertRows(rowIdKey, setEditableRows),
    removeRows: mkRemoveRows(rowIdKey, setEditableRows),
    revertRows: mkRevertRows(rowIdKey, setEditableRows),
    commitRows: mkCommitRows(rowIdKey, setEditableRows),
    updateRow,
  }

  const prim = { editableRows, columns }

  return { rows, edit, prim }
}

// Exported utils

export const getEditStatusClassName = ({ isDirty, isNew, isRemoved }: EditStatus<unknown>): string =>
  [isDirty ? 'is-dirty' : '', isNew ? 'is-new' : '', isRemoved ? 'is-removed' : ''].join(' ')

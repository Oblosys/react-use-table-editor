/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * @jest-environment jsdom
 */
import '@testing-library/react'

import { RenderResult, act, renderHook } from '@testing-library/react-hooks'

import { Editable, UseTableEditor, getEditStatus, useTableEditor } from './useTableEditor'

interface User {
  username: string
  fullName: [string, string]
  credits: number
}

const testUsers: User[] = [
  { username: 'dan', fullName: ['Toucan', 'Dan'], credits: 10 },
  { username: 'dave', fullName: ['Chiquita', 'Dave'], credits: 80 },
  { username: 'truck', fullName: ['Truck', 'Shepard'], credits: 30 },
  { username: 'vader', fullName: ['Dark', 'Vader'], credits: 75 },
]

let hook: RenderResult<UseTableEditor<User, 'username'>>

beforeEach(() => {
  hook = renderHook(() => useTableEditor('username', [], testUsers)).result
})

const editableRows = () => hook.current.prim.editableRows
const editableRowByRowId = (username: string) => {
  const editableRow = editableRows().find((row) => row.username === username)
  if (!editableRow) {
    throw new Error(`No editable row found for username ${username}`)
  }
  return editableRow
}

const updateRowCell =
  (rowId: string) =>
  <ColumnKey extends keyof User>(columnKey: ColumnKey) =>
  (cellUpdate: (prev: User[ColumnKey]) => User[ColumnKey]) =>
    act(() => hook.current.prim.updateRowCellByRowId(rowId)(columnKey)(cellUpdate))

const insertRows = (rows: User[]) => act(() => hook.current.edit.insertRows(rows))
const removeRows = (editableRows: Editable<User>[]) => act(() => hook.current.edit.removeRows(editableRows))
const commitRows = (editableRows: Editable<User>[]) => act(() => hook.current.edit.commitRows(editableRows))
const revertRows = (editableRows: Editable<User>[]) => act(() => hook.current.edit.revertRows(editableRows))

// TODO: Test combinations & operations multiple rows. Run tests on root test command (maybe ditch CRA tests).
describe('prim.updateRowCellByRowId', () => {
  test('update and commit', () => {
    const rowCount = editableRows().length
    updateRowCell('dan')('credits')((prev) => prev + 10)
    expect(editableRowByRowId('dan')).toEqual(expect.objectContaining({ credits: 20 }))
    expect(getEditStatus(editableRowByRowId('dan'))).toEqual(
      expect.objectContaining({ isDirty: true, isNew: false, isRemoved: false }),
    )
    commitRows([editableRowByRowId('dan')])
    expect(editableRows()).toHaveLength(rowCount)
    expect(getEditStatus(editableRowByRowId('dan'))).toEqual(
      expect.objectContaining({ isDirty: false, isNew: false, isRemoved: false }),
    )
  })

  test('update and revert', () => {
    const rowCount = editableRows().length
    updateRowCell('dan')('credits')((prev) => prev + 10)
    expect(editableRowByRowId('dan')).toEqual(expect.objectContaining({ credits: 20 }))
    revertRows([editableRowByRowId('dan')])
    expect(editableRows()).toHaveLength(rowCount)
    expect(editableRowByRowId('dan')).toEqual(expect.objectContaining({ credits: 10 }))
    expect(getEditStatus(editableRowByRowId('dan'))).toEqual(
      expect.objectContaining({ isDirty: false, isNew: false, isRemoved: false }),
    )
  })
})

describe('edit.insert', () => {
  test('insert and commit', () => {
    const newRow: User = { username: 'testuser', fullName: ['Test', 'User'], credits: 42 }
    const rowCount = editableRows().length
    insertRows([newRow])
    expect(editableRows()).toHaveLength(rowCount + 1)
    expect(getEditStatus(editableRowByRowId('testuser'))).toEqual(
      expect.objectContaining({ isDirty: false, isNew: true, isRemoved: false }),
    )
    commitRows([editableRowByRowId('testuser')])
    expect(editableRows()).toHaveLength(rowCount + 1)
    expect(getEditStatus(editableRowByRowId('testuser'))).toEqual(
      expect.objectContaining({ isDirty: false, isNew: false, isRemoved: false }),
    )
  })

  test('insert and revert', () => {
    const newRow: User = { username: 'testuser', fullName: ['Test', 'User'], credits: 42 }
    const rowCount = editableRows().length
    insertRows([newRow])
    revertRows([editableRowByRowId('testuser')])
    expect(editableRows()).toHaveLength(rowCount)
    expect(editableRows()).not.toEqual(expect.arrayContaining([expect.objectContaining({ username: 'testuser' })]))
  })
})

describe('edit.remove', () => {
  test('remove and commit', () => {
    const rowCount = editableRows().length
    removeRows([editableRowByRowId('dave')])
    expect(editableRows()).toHaveLength(rowCount)
    expect(getEditStatus(editableRowByRowId('dave'))).toEqual(
      expect.objectContaining({ isDirty: false, isNew: false, isRemoved: true }),
    )
    commitRows([editableRowByRowId('dave')])
    expect(editableRows()).toHaveLength(rowCount - 1)
    expect(editableRows()).not.toEqual(expect.arrayContaining([expect.objectContaining({ username: 'dave' })]))
  })

  test('remove and revert', () => {
    const rowCount = editableRows().length
    removeRows([editableRowByRowId('dave')])
    expect(editableRows()).toHaveLength(rowCount)
    expect(getEditStatus(editableRowByRowId('dave'))).toEqual(
      expect.objectContaining({ isDirty: false, isNew: false, isRemoved: true }),
    )
    revertRows([editableRowByRowId('dave')])
    expect(editableRows()).toHaveLength(rowCount)
    expect(getEditStatus(editableRowByRowId('dave'))).toEqual(
      expect.objectContaining({ isDirty: false, isNew: false, isRemoved: false }),
    )
  })
})

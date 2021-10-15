import '@testing-library/react'

import { RenderResult, act, renderHook } from '@testing-library/react-hooks'

import { Columns, Editable, getEditStatus, mkEditable } from './editable'
import { UseTableEditor, applyRowUpdateByRowId, useTableEditor } from './useTableEditor'

interface User {
  username: string
  fullName: [string, string]
  credits: number
}

const editableRowKeys: (keyof User)[] = ['fullName', 'credits']

const testUsers: User[] = [
  { username: 'dan', fullName: ['Toucan', 'Dan'], credits: 10 },
  { username: 'dave', fullName: ['Chiquita', 'Dave'], credits: 80 },
  { username: 'truck', fullName: ['Truck', 'Shepard'], credits: 30 },
  { username: 'vader', fullName: ['Dark', 'Vader'], credits: 75 },
]

const columns: Columns<User> = [
  {
    key: 'fullName',
    eq: ([pristineFirst, pristineLast], [currentFirst, currentLast]) =>
      pristineFirst === currentFirst && pristineLast === currentLast,
  },
  { key: 'credits' },
]

let hook: RenderResult<UseTableEditor<User, 'username'>>

beforeEach(() => {
  hook = renderHook(() => useTableEditor('username', columns, testUsers)).result
})

// Shorthands for accessing and looking up editable rows.
const editableRows = () => hook.current.prim.editableRows
const editableRowByRowId = (username: string) => {
  const editableRow = editableRows().find((row) => row.username === username)
  if (!editableRow) {
    throw new Error(`No editable row found for username ${username}`)
  }
  return editableRow
}

// Shorthands for calling hook edit operations.
const insertRows = (rows: User[]) => act(() => hook.current.edit.insertRows(rows))
const removeRows = (editableRows: Editable<User>[]) => act(() => hook.current.edit.removeRows(editableRows))
const commitRows = (editableRows: Editable<User>[]) => act(() => hook.current.edit.commitRows(editableRows))
const revertRows = (editableRows: Editable<User>[]) => act(() => hook.current.edit.revertRows(editableRows))
const updateRow = (rowUpdate: (prev: User) => User, row: User) => act(() => hook.current.edit.updateRow(rowUpdate, row))

// TODO:
// - Test combinations & operations multiple rows.
// - Test hook.current.rows & prim.
// - Test cell updater (is now local to EditableTable).
// - Restrict package exports from an index.ts module, now useTableEditor exports internals for testing.

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

describe('updateRowByRowId', () => {
  test('update and commit', () => {
    const editableTestUsers = testUsers.map(mkEditable)
    const rowUpdate: (prev: User) => User = (prev) => ({ ...prev, credits: prev.credits + 1 })

    const updatedRows = applyRowUpdateByRowId('username', editableRowKeys, {}, 'dave', rowUpdate)(editableTestUsers)
    expect(updatedRows).toHaveLength(4)
  })
})

describe('edit.updateRow', () => {
  test('update and commit', () => {
    const rowCount = editableRows().length
    updateRow((prev) => ({ ...prev, credits: -42 }), editableRowByRowId('dave'))
    expect(editableRowByRowId('dave')).toEqual(expect.objectContaining({ credits: -42 }))
    expect(getEditStatus(editableRowByRowId('dave'))).toEqual(
      expect.objectContaining({ isDirty: true, isNew: false, isRemoved: false }),
    )
    commitRows([editableRowByRowId('dave')])
    expect(editableRows()).toHaveLength(rowCount)
    expect(getEditStatus(editableRowByRowId('dave'))).toEqual(
      expect.objectContaining({ isDirty: false, isNew: false, isRemoved: false }),
    )
  })

  test('update and restore (custom equality)', () => {
    const rowCount = editableRows().length
    updateRow((prev) => ({ ...prev, fullName: ['Chiquitaa', 'Dave'] }), editableRowByRowId('dave'))
    expect(editableRowByRowId('dave').fullName).toEqual(['Chiquitaa', 'Dave'])
    expect(getEditStatus(editableRowByRowId('dave'))).toEqual(
      expect.objectContaining({ isDirty: true, isNew: false, isRemoved: false }),
    )

    updateRow((prev) => ({ ...prev, fullName: ['Chiquita', 'Dave'] }), editableRowByRowId('dave'))
    expect(editableRows()).toHaveLength(rowCount)
    expect(getEditStatus(editableRowByRowId('dave'))).toEqual(
      expect.objectContaining({ isDirty: false, isNew: false, isRemoved: false }),
    )
  })
})

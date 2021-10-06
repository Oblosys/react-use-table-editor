import '@testing-library/react'

import { act, renderHook } from '@testing-library/react-hooks'

import { useEditableTable } from './EditableTable'

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

// TODO: Add a lot more tests.

test('edit.insert', () => {
  const newRow: User = { username: 'testuser', fullName: ['Test', 'User'], credits: 42 }
  const hook = renderHook(() => useEditableTable('username', testUsers)).result
  act(() => hook.current.edit.insertRows([newRow]))
  const { editableRows } = hook.current.prim

  expect(editableRows).toHaveLength(5)
  expect(editableRows[4].current).toBe(newRow)
})

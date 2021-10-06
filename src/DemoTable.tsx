import faker from 'faker'

import { FullNameInput, IntegerInput } from './DemoInputs'
import { Editable, EditableTable, getEditStatusClassName, useEditableTable } from './lib/EditableTable'

import './DemoTable.css'

const sumBy = <K extends keyof T, T extends Record<K, number>>(key: K, objs: T[]) =>
  objs.reduce((s, obj) => s + obj[key], 0)

interface User {
  username: string
  fullName: [string, string]
  credits: number
}

const initialUsers: User[] = [
  { username: 'dan', fullName: ['Toucan', 'Dan'], credits: 10 },
  { username: 'dave', fullName: ['Chiquita', 'Dave'], credits: 80 },
  { username: 'truck', fullName: ['Truck', 'Shepard'], credits: 30 },
  { username: 'vader', fullName: ['Dark', 'Vader'], credits: 75 },
]

const showUserNames = (users: User[]) => `[${users.map(({ username }) => `'${username}'`).join(', ')}]`

export const DemoTable = (): JSX.Element => {
  const { rows, edit, prim } = useEditableTable<User, 'username'>('username', initialUsers)

  const handleAddRow = () => {
    const firstName = faker.name.firstName()
    const lastName = faker.name.lastName()

    edit.insertRows([
      {
        username: faker.internet.userName(firstName, lastName),
        fullName: [firstName, lastName],
        credits: Math.floor(Math.random() * 200),
      },
    ])
  }

  // A real-world handleSave can post the changes to a server and set the rows on success.
  const handleSave = (rows: Editable<User>[]) => () => edit.commitRows(rows)

  const serverSideCredits = sumBy('credits', rows.pristine)
  const currentCredits = sumBy('credits', rows.current)

  // Difference with server-side total due to edited rows.
  const deltaCredits = currentCredits - serverSideCredits

  return (
    <div>
      <h3>
        Demo table <input type="button" value="Reset table" onClick={() => edit.initializeTable(initialUsers)} />
      </h3>
      <div>
        Total credits: {serverSideCredits + deltaCredits}{' '}
        {deltaCredits !== 0 ? ' = ' + serverSideCredits + (deltaCredits > 0 ? '+' : '') + deltaCredits : ''}
      </div>
      <div className="table-stats">
        <input className="add-row-button" type="button" value="Add row" onClick={handleAddRow} />
        <input
          className="save-button"
          type="button"
          value="Save"
          disabled={rows.dirty.length === 0}
          onClick={handleSave(rows.dirty)}
        />
        Row count: {rows.current.length}, Modified: {rows.dirty.length}
      </div>

      <EditableTable<User, 'username'> // Type params can be inferred, but specifying them give more readable errors.
        className="demo-table"
        rowIdKey="username"
        editableRows={prim.editableRows}
        mkUpdateRowCellByRowId={prim.mkUpdateRowCellByRowId}
        renderRow={(renderedCells, editStatus) => (
          <tr className={getEditStatusClassName(editStatus)}>{renderedCells}</tr>
        )}
        renderTable={(renderedHeaderRow, renderedRows) => (
          <table>
            <thead>
              <tr>{renderedHeaderRow}</tr>
            </thead>
            <tbody>{renderedRows}</tbody>
          </table>
        )}
        columns={[
          {
            title: 'Remove',
            renderMetaCell: (editableRow, { isRemoved }) => (
              <td className="remove-cell" onClick={() => edit.removeRows([editableRow])}>
                {!isRemoved ? (
                  <span role="img" aria-label="Remove row">
                    ❌
                  </span>
                ) : null}
              </td>
            ),
          },
          {
            key: 'username',
            title: 'Username',
            renderHeaderCell: (title) => <th className="username-column">{title}</th>,
          },
          {
            key: 'fullName',
            title: 'Full name',
            eq: ([pristineFirst, pristineLast], [currentFirst, currentLast]) =>
              pristineFirst === currentFirst && pristineLast === currentLast,
            renderCell: (fullNameState, _isDirty, [pristineFirst, pristineLast]) => {
              const [[firstName, lastName]] = fullNameState
              const isDirty: [boolean, boolean] = [firstName !== pristineFirst, lastName !== pristineLast]
              return (
                <td>
                  <FullNameInput stateRef={fullNameState} isDirty={isDirty} />
                </td>
              )
            },
          },
          {
            key: 'credits',
            title: 'Credits',
            renderHeaderCell: (title) => <th className="credits-column">{title}</th>,
            renderCell: (state, isDirty) => (
              <td>
                <IntegerInput stateRef={state} isDirty={isDirty} />
              </td>
            ),
          },
          {
            title: 'Undo',
            renderHeaderCell: (title) => <th className="undo-column">{title}</th>,
            renderMetaCell: (editableRow, editStatus) => (
              <td>
                {editStatus.isDirty || editStatus.isNew || editStatus.isRemoved ? ( // TODO: Just want one condition here.
                  <input type="button" value="undo" onClick={() => edit.revertRows([editableRow])} />
                ) : null}
              </td>
            ),
          },
          {
            title: 'Save',
            renderHeaderCell: (title) => <th className="undo-column">{title}</th>,
            renderMetaCell: (editableRow, editStatus) => (
              <td>
                {editStatus.isDirty || editStatus.isNew || editStatus.isRemoved ? (
                  <input type="button" value="save" onClick={handleSave([editableRow])} />
                ) : null}
              </td>
            ),
          },
        ]}
      />

      <h3>Debug</h3>
      <table className="debug-table">
        <tbody>
          <tr>
            <td>current</td>
            <td>{showUserNames(rows.current)}</td>
          </tr>
          <tr>
            <td>pristine</td>
            <td>{showUserNames(rows.pristine)}</td>
          </tr>
          <tr>
            <td>dirty</td>
            <td>{showUserNames(rows.dirty.map(({ current }) => current))}</td>
          </tr>
          <tr>
            <td>removed</td>
            <td>{showUserNames(rows.removed.map(({ current }) => current))}</td>
          </tr>
          <tr>
            <td>new</td>
            <td>{showUserNames(rows.new.map(({ current }) => current))}</td>
          </tr>
        </tbody>
      </table>
      <br />
      <table className="debug-table">
        <thead>
          <tr>
            <th>row.current</th>
            <th>row.pristine</th>
            <th>row.editStatus</th>
          </tr>
        </thead>
        <tbody>
          {prim.editableRows.map(({ editStatus, current, pristine }) => (
            <tr key={current.username}>
              <td>{JSON.stringify(current)}</td>
              <td>{JSON.stringify(pristine)}</td>
              <td>{JSON.stringify(editStatus)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DemoTable

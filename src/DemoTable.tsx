import faker from 'faker'

import { FullNameInput, IntegerInput } from './DemoInputs'
import {
  Editable,
  EditableTable,
  getEditStatusClassName,
  getIsDirty,
  getPristineRow,
  stripEditable,
  useTableEditor,
} from './lib/useTableEditor'

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
  const { rows, edit, prim } = useTableEditor<User, 'username'>('username', initialUsers)

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
        Demo table{' '}
        <input
          type="button"
          className="reset-button"
          value="Reset table"
          onClick={() => edit.initializeTable(initialUsers)}
        />
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
          <table data-testid="demo-table">
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
            renderCell: ([username]) => <td className="value-cell">{username}</td>,
          },
          {
            key: 'fullName',
            title: 'Full name',
            eq: ([pristineFirst, pristineLast], [currentFirst, currentLast]) =>
              pristineFirst === currentFirst && pristineLast === currentLast,
            renderCell: (fullNameState, { pristine: [pristineFirst, pristineLast] }, rowEditStatus) => {
              const [[firstName, lastName]] = fullNameState
              const isDirty: [boolean, boolean] = [firstName !== pristineFirst, lastName !== pristineLast]
              return (
                <td className="value-cell">
                  <FullNameInput stateRef={fullNameState} isDirty={isDirty} isDisabled={rowEditStatus.isRemoved} />
                </td>
              )
            },
          },
          {
            key: 'credits',
            title: 'Credits',
            renderHeaderCell: (title) => <th className="credits-column">{title}</th>,
            renderCell: (state, { isDirty }, rowEditStatus) => (
              <td className="value-cell">
                <IntegerInput stateRef={state} isDirty={isDirty} isDisabled={rowEditStatus.isRemoved} />
              </td>
            ),
          },
          {
            title: 'Undo',
            renderHeaderCell: (title) => <th className="undo-column">{title}</th>,
            renderMetaCell: (editableRow, rowEditStatus) => (
              <td>
                {rowEditStatus.isDirty || rowEditStatus.isNew || rowEditStatus.isRemoved ? ( // TODO: Just want one condition here.
                  <input type="button" value="undo" onClick={() => edit.revertRows([editableRow])} />
                ) : null}
              </td>
            ),
          },
          {
            title: 'Save',
            renderHeaderCell: (title) => <th className="undo-column">{title}</th>,
            renderMetaCell: (editableRow, rowEditStatus) => (
              <td>
                {rowEditStatus.isDirty || rowEditStatus.isNew || rowEditStatus.isRemoved ? (
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
            <td>{showUserNames(rows.dirty)}</td>
          </tr>
          <tr>
            <td>removed</td>
            <td>{showUserNames(rows.removed)}</td>
          </tr>
          <tr>
            <td>new</td>
            <td>{showUserNames(rows.new)}</td>
          </tr>
        </tbody>
      </table>
      <br />
      <table className="debug-table">
        <thead>
          <tr>
            <th>current</th>
            <th>pristine</th>
            <th>isdirty</th>
          </tr>
        </thead>
        <tbody>
          {prim.editableRows.map((row) => (
            <tr key={row.username}>
              <td>{JSON.stringify(stripEditable(row))}</td>
              <td>{JSON.stringify(getPristineRow(row))}</td>
              <td>{JSON.stringify(getIsDirty(row))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DemoTable

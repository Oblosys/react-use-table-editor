/**
 * Package is awkward to use, has bad js-style types, and seems unmaintained, so probably not ideal for a demo.
 */

import MaterialTable, { Column } from 'material-table'

import { Editable, getIsDirty, getIsNew, getIsRemoved } from '../lib/EditableTable'
import { setDirtyCellStyleProperty, useMaterialTableEditor } from './UseMaterialTableEditor'
import './MaterialDemo.css'

interface User {
  username: string
  fullName: string
  credits: number
}

const initialUsers: User[] = [
  { username: 'dan', fullName: 'Toucan Dan', credits: 10 },
  { username: 'dave', fullName: 'Chiquita Dave', credits: 80 },
  { username: 'truck', fullName: 'Truck Shepard', credits: 30 },
  { username: 'vader', fullName: 'Dark Vader', credits: 75 },
]

const MaterialDemo = (): JSX.Element => {
  const { rows, edit } = useMaterialTableEditor<User, 'username'>('username', initialUsers)

  // Somehow this is not called to determine editability for cellEditable, even though editable = 'never' does block
  // cellEditable.
  // const editable: (columnDef: Column<Editable<User>>, rowData: Editable<User>) => boolean = (columnDef, rowData) => {
  //   console.log('editable', columnDef, rowData)
  //   if (columnDef.field === 'username') {
  //     return false
  //   }
  //   return false
  // }
  return (
    <div className="material-demo">
      <MaterialTable
        title="Editable Example"
        columns={[
          {
            title: 'username',
            field: 'username',
            editable: 'onAdd' as const,
            initialEditValue: 'new_username',
          },
          { title: 'Full name', field: 'fullName' },
          {
            title: 'Credits',
            field: 'credits',
            type: 'numeric' as const,
          },
        ].map<Column<Editable<User>>>(setDirtyCellStyleProperty)}
        data={rows}
        editable={{
          isEditable: (row) => !getIsRemoved(row), // only works for onRowUpdate
          isDeletable: (row) => !getIsRemoved(row),
          onRowUpdate: edit.asyncUpdateRow,
          onRowAdd: edit.asyncInsertRow,
          onRowDelete: edit.asyncRemoveRow,
        }}
        // Can't use cellEditable, because we cannot block editing of username (or block it with never so we also
        // cannot edit it on new), and we cannot block editing in removed rows.
        // cellEditable={{ onCellEditApproved: asyncUpdateCell }}
        options={{
          rowStyle: (row) => ({
            backgroundColor: getIsNew(row) ? '#ffffc0' : getIsDirty(row) ? '#eff2ff' : 'inherit',
            textDecoration: getIsRemoved(row) ? 'line-through' : 'inherit',
          }),
        }}
      />
    </div>
  )
}

export default MaterialDemo

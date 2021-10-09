import { prettyDOM, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import DemoTable from './DemoTable'

const getRows = (tableElt: HTMLElement) => within(tableElt).getAllByRole('row').slice(1)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const prettyElts = (rows: HTMLElement[]) => rows.map((row) => prettyDOM(row)).join('\n')

// A very general integration test to signal when something is wrong.
// TODO: Cover more edit actions + test row values & style.
test('Canary', () => {
  render(<DemoTable />)
  const demoTableElt = screen.getByTestId('demo-table')
  let rows = getRows(demoTableElt)
  expect(rows).toHaveLength(4)

  const addRowButtonElt = screen.getByRole('button', { name: 'Add row' })
  userEvent.click(addRowButtonElt)
  rows = getRows(demoTableElt)
  expect(rows).toHaveLength(5)

  const SaveButtonElt = screen.getByRole('button', { name: 'Save' })
  userEvent.click(SaveButtonElt)
  rows = getRows(demoTableElt)
  expect(rows).toHaveLength(5)

  const removeRowButtonElts = within(demoTableElt).getAllByLabelText('Remove row')
  userEvent.click(removeRowButtonElts[2])
  rows = getRows(demoTableElt)
  expect(rows).toHaveLength(5)

  userEvent.click(SaveButtonElt)
  rows = getRows(demoTableElt)
  expect(rows).toHaveLength(4)
})

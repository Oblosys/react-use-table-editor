import { StateRef } from './lib/EditableTable'

const zeroForNaN = (num: number) => (isNaN(num) ? 0 : num)

interface DollarInputProps {
  stateRef: StateRef<number>
  isDirty: boolean
}
export const IntegerInput = ({ stateRef: [val, setVal], isDirty }: DollarInputProps): JSX.Element => (
  <input
    className={'integer-input' + (isDirty ? ' is-dirty' : '')}
    value={val}
    onChange={(e) => setVal(zeroForNaN(+e.target.value))}
    type="text"
  />
)

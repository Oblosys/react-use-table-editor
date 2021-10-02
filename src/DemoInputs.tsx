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

interface FullNameInputProps {
  stateRef: StateRef<[v1: string, v2: string]>
  isDirty: [boolean, boolean]
}

export const FullNameInput = ({
  stateRef: [[firstName, lastName], setName],
  isDirty: [isDirtyFirst, isDirtyLast],
}: FullNameInputProps): JSX.Element => (
  <span>
    <input
      className={'name-input' + (isDirtyFirst ? ' is-dirty' : '')}
      value={firstName}
      onChange={(e) => setName(([, previousLastName]) => [e.target.value, previousLastName])}
      type="text"
    />
    <input
      className={'name-input' + (isDirtyLast ? ' is-dirty' : '')}
      value={lastName}
      onChange={(e) => setName(([previousFirstName]) => [previousFirstName, e.target.value])}
      type="text"
    />
  </span>
)

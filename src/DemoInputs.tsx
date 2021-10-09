import { StateRef } from './lib/useTableEditor'

const zeroForNaN = (num: number) => (isNaN(num) ? 0 : num)

interface DollarInputProps {
  stateRef: StateRef<number>
  isDirty: boolean
  isDisabled?: boolean
}
export const IntegerInput = ({
  stateRef: [val, setVal],
  isDirty,
  isDisabled = false,
}: DollarInputProps): JSX.Element => (
  <input
    className={'integer-input' + (isDirty ? ' is-dirty' : '')}
    type="text"
    value={val}
    onChange={(e) => setVal(zeroForNaN(+e.target.value))}
    disabled={isDisabled}
  />
)

interface FullNameInputProps {
  stateRef: StateRef<[v1: string, v2: string]>
  isDirty: [boolean, boolean]
  isDisabled?: boolean
}

export const FullNameInput = ({
  stateRef: [[firstName, lastName], setName],
  isDirty: [isDirtyFirst, isDirtyLast],
  isDisabled = false,
}: FullNameInputProps): JSX.Element => (
  <span>
    <input
      className={'name-input' + (isDirtyFirst ? ' is-dirty' : '')}
      type="text"
      value={firstName}
      onChange={(e) => setName(([, previousLastName]) => [e.target.value, previousLastName])}
      disabled={isDisabled}
    />
    <input
      className={'name-input' + (isDirtyLast ? ' is-dirty' : '')}
      type="text"
      value={lastName}
      onChange={(e) => setName(([previousFirstName]) => [previousFirstName, e.target.value])}
      disabled={isDisabled}
    />
  </span>
)

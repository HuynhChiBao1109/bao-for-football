import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
}

export function Input({ label, id, className = '', ...rest }: Props) {
  const inputEl = <input id={id} className={`game-input ${className}`} {...rest} />

  if (!label) return inputEl

  return (
    <label className="block" htmlFor={id}>
      <span className="game-field-label">{label}</span>
      {inputEl}
    </label>
  )
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  options: { value: string | number; label: string }[]
}

export function Select({ label, id, options, className = '', ...rest }: SelectProps) {
  const selectEl = (
    <select id={id} className={`game-input ${className}`} {...rest}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )

  if (!label) return selectEl

  return (
    <label className="block" htmlFor={id}>
      <span className="game-field-label">{label}</span>
      {selectEl}
    </label>
  )
}

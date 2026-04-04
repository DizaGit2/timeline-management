interface Props {
  label: string
  id: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  disabled?: boolean
  error?: string
}

export function FormField({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  error,
}: Props) {
  return (
    <div style={s.group}>
      <label htmlFor={id} style={s.label}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        style={{ ...s.input, ...(error ? s.inputError : {}) }}
      />
      {error && <p style={s.errorText}>{error}</p>}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  group: { marginBottom: '1rem' },
  label: {
    display: 'block',
    marginBottom: 4,
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
  },
  input: {
    width: '100%',
    padding: '0.625rem 0.75rem',
    border: '1.5px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 14,
    color: '#1e293b',
    background: '#f8fafc',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  inputError: {
    borderColor: '#ef4444',
    background: '#fff5f5',
  },
  errorText: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#ef4444',
  },
}

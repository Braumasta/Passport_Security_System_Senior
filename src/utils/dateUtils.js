export const toDateInputValue = (value) => {
  if (!value) {
    return ''
  }

  if (typeof value === 'string') {
    const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (dateOnlyMatch) {
      return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`
    }
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  const year = parsedDate.getFullYear()
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
  const day = String(parsedDate.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export const formatDisplayDate = (value) => {
  if (!value) {
    return 'Not provided'
  }

  if (typeof value === 'string') {
    const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch
      return `${Number(day)} ${new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(
        new Date(Date.UTC(Number(year), Number(month) - 1, 1))
      )} ${year}`
    }
  }

  const displayValue =
    typeof value === 'string' &&
    value.includes('T') &&
    !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)
      ? `${value}Z`
      : value

  return new Date(displayValue).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Beirut',
  })
}

export const inferCurrentSemester = (date = new Date()): string => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  return month >= 8 ? `FALL_${year}` : month <= 5 ? `SPRING_${year}` : `FALL_${year}`
}

export const getNextSemester = (semester: string): string => {
  const [season, rawYear] = semester.split('_')
  const year = Number(rawYear)
  return season === 'FALL' ? `SPRING_${year + 1}` : `FALL_${year}`
}

export const formatSemester = (semester: string): string => {
  const [season, year] = semester.split('_')
  return `${season.charAt(0)}${season.slice(1).toLowerCase()} ${year}`
}

export const buildSemesterOptions = (used: string[]): string[] => {
  const current = inferCurrentSemester()
  const next = getNextSemester(current)
  const unique = new Set([current, next, ...used.filter(Boolean)])
  return [...unique].sort((a, b) => {
    const [aSeason, aYear] = a.split('_')
    const [bSeason, bYear] = b.split('_')
    const aOrder = Number(aYear) * 2 + (aSeason === 'FALL' ? 1 : 0)
    const bOrder = Number(bYear) * 2 + (bSeason === 'FALL' ? 1 : 0)
    return bOrder - aOrder
  })
}

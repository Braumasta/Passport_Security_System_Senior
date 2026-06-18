const TOKEN_KEY = 'passportToken'
const USER_KEY = 'passportUser'

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY) || ''

export const getStoredUser = () => {
  const rawUser = localStorage.getItem(USER_KEY)

  if (!rawUser) {
    return null
  }

  try {
    return JSON.parse(rawUser)
  } catch (error) {
    localStorage.removeItem(USER_KEY)
    return null
  }
}

export const getStoredSession = () => ({
  token: getStoredToken(),
  user: getStoredUser(),
})

export const saveSession = ({ token, user }) => {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

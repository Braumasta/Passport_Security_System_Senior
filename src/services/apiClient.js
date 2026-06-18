const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
const API_ROOT_URL = API_BASE_URL.replace(/\/api\/?$/, '')

const buildHeaders = ({ token, extraHeaders = {}, hasFormData = false }) => {
  const headers = {
    ...extraHeaders,
  }

  if (!hasFormData) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

export const apiRequest = async (path, options = {}) => {
  const { method = 'GET', body, token, headers } = options
  const hasFormData = typeof FormData !== 'undefined' && body instanceof FormData

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildHeaders({ token, extraHeaders: headers, hasFormData }),
    body: body ? (hasFormData ? body : JSON.stringify(body)) : undefined,
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.message || 'Request failed')
  }

  return data
}

export const resolveApiAssetUrl = (assetPath) => {
  if (!assetPath) {
    return ''
  }

  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath
  }

  return `${API_ROOT_URL}${assetPath.startsWith('/') ? assetPath : `/${assetPath}`}`
}

export { API_BASE_URL, API_ROOT_URL }

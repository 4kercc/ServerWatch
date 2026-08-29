import axios from 'axios'

const http = axios.create({
  baseURL: '',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = token
  }
  return config
})

http.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token')
      if (window.location.pathname !== '/signin') {
        window.location.href = '/signin'
      }
    }
    return Promise.reject(error)
  }
)

export default http

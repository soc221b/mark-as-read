export let globalPromise = null
export const wait = maybePromise => {
  if (globalPromise) {
    globalPromise.then(maybePromise)
  } else {
    globalPromise = isPromise ? maybePromise : Promise.then(maybePromise)
  }
}

export const isPromise = object => {
  if (typeof object !== 'object') return false
  if (typeof object.then !== 'function') return false
  return true
}

export const debounce = (fn, ms = 0) => {
  let timeout = null
  return () => {
    clearTimeout(timeout)
    timeout = setTimeout(fn, ms)
  }
}

export const createRange = (start, end) => {
  return Array(end - start + 1)
    .fill(null)
    .map((_, index) => index + start)
}

let href = location.href
export const onLocationChange = callback => {
  window.addEventListener('click', () => {
    requestAnimationFrame(() => {
      if (host !== window.location.href) {
        host = window.location.href
        callback()
      }
    })
  })
}

let host = window.location.host
export const onHostChange = callback => {
  window.addEventListener('click', () => {
    requestAnimationFrame(() => {
      if (host !== window.location.host) {
        host = window.location.host
        callback()
      }
    })
  })
}

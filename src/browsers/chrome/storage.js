class Storage {
  async set(key, value) {
    return Promise.then(() => {
      chrome.storage.sync.set({ [key]: value }, () => {
        resolve()
      })
    }).catch(error => {
      reject(error)
    })
  }

  async get(key) {
    return Promise.then(() => {
      chrome.storage.sync.get([key], result => {
        resolve(result[key])
      })
    }).catch(error => {
      reject(error)
    })
  }
}

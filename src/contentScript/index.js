import { debounce, createRange, onLocationChange } from '../util'
import createRepository from '../repositories/RepositoryFactory'

let repository = null
createRepository()
onLocationChange(() => {
  repository = createRepository()
})

const observe = callback => {
  const observer = new MutationObserver(function (mutations) {
    callback()
  })

  const config = {
    childList: true,
    subtree: true,
  }

  observer.observe(document.documentElement, config)

  return observer
}

const getTrs = lineNumbers => {
  return lineNumbers
    .map(lineNumber => `#L${lineNumber}`)
    .map(tdId => document.querySelector(tdId))
    .filter(td => td !== null)
    .map(td => td.parentElement)
}

let oldLineNumbers = []
const markRead = () => {
  const key = getRepoId()
  chrome.storage.sync.get([key], result => {
    const lineNumbers = JSON.parse(result[key] || null) || []

    const trs = getTrs(lineNumbers)

    getTrs(oldLineNumbers).forEach(tr => tr.classList.remove('mark-as-read--read'))
    trs.forEach(tr => tr.classList.add('mark-as-read--read'))

    oldLineNumbers = lineNumbers
  })
}

const updateLineNumbers = selectedLineNumbers => {
  const key = getRepoId()
  chrome.storage.sync.get([key], result => {
    const oldLineNumbers = JSON.parse(result[key] || null) || []
    const oldLineNumberSet = new Set(oldLineNumbers)
    const selectedLineNumberSet = new Set(selectedLineNumbers)
    const newLineNumbers = selectedLineNumbers.every(lineNumber => oldLineNumberSet.has(lineNumber))
      ? oldLineNumbers.filter(lineNumber => selectedLineNumberSet.has(lineNumber) === false)
      : [...new Set(oldLineNumbers.concat(selectedLineNumbers))]

    const value = JSON.stringify(newLineNumbers)
    chrome.storage.sync.set({ [key]: value })
  })
}

const updateLineNumbersForHash = () => {
  const range = window.location.hash.slice(1).split('-')
  const startLineNumber = parseInt(range[0].slice(1), 10)
  const endLineNumber = parseInt((range[1] || range[0]).slice(1), 10)

  const selectedLineNumbers = createRange(startLineNumber, endLineNumber)

  updateLineNumbers(selectedLineNumbers)
}
const debouncedUpdateLineNumbersForHash = debounce(updateLineNumbersForHash)

let lastMousedownEvent = null
let lastMouseupEvent = null
const updateLineNumbersForDrag = () => {
  if (lastMousedownEvent === null || lastMouseupEvent === null) return
  if (
    lastMousedownEvent.clientX === lastMouseupEvent.clientX &&
    lastMousedownEvent.clientY === lastMouseupEvent.clientY
  )
    return

  const findTd = el => {
    while (el) {
      if (el.nodeName === 'TR') break
      el = el.parentElement
    }
    if (el) el = el.children[0]
    return el
  }
  const startTd = findTd(lastMousedownEvent.srcElement)
  const endTd = findTd(lastMouseupEvent.srcElement)

  if (startTd && endTd) {
    let startLineNumber = parseInt(startTd.id.slice(1), 10)
    let endLineNumber = parseInt(endTd.id.slice(1), 10)
    if (startLineNumber > endLineNumber) {
      const temp = startLineNumber
      startLineNumber = endLineNumber
      endLineNumber = temp
    }
    const selectedLineNumbers = createRange(startLineNumber, endLineNumber)
    updateLineNumbers(selectedLineNumbers)
  }
}
const debouncedUpdateLineNumbersForDrag = debounce(updateLineNumbersForDrag)

const tdIeRe = /^L\d+$/
const listenClickTd = () => {
  document.querySelector('table').addEventListener('click', event => {
    if (tdIeRe.test(event.srcElement.id)) {
      debouncedUpdateLineNumbersForHash()
    }
  })
  document.querySelector('table').addEventListener('mousedown', event => {
    if (tdIeRe.test(event.srcElement.id) === false) {
      lastMousedownEvent = event
    }
  })
  document.querySelector('table').addEventListener('mouseup', event => {
    if (tdIeRe.test(event.srcElement.id) === false) {
      lastMouseupEvent = event
      debouncedUpdateLineNumbersForDrag()
    }
  })
}

let shaMapping = null
let shaMappingPromise = null
const fetchShaMapping = async () => {
  if (shaMapping === null) {
    shaMapping = {
      branches: {},
      tags: {},
      shas: {},
    }
    shaMappingPromise = await Promise.all([getShaMappingForBranchesOrTags(), getShaMappingForBranchesOrTags(false)])
  }
  await shaMappingPromise
  markRead()
  return shaMapping
}

const getShaMappingForBranchesOrTags = async (isBranch = true) => {
  return new Promise(resolve => {
    var xhr = new XMLHttpRequest()
    const branchesOrTags = isBranch ? 'branches' : 'tags'
    xhr.open('GET', `https://api.github.com/repos/${getRepoName()}/${branchesOrTags}`, true)

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.response)
        tags = response.map(item => item.name)
        sha = response.map(item => item.commit.sha)
        response.forEach(item => {
          shaMapping[branchesOrTags][item.name] = item.commit.sha
          shaMapping.shas[item.commit.sha] = shaMapping.shas[item.commit.sha] || []
          shaMapping.shas[item.commit.sha].push(item.name)
        })
      } catch (error) {
        // do nothing
      } finally {
        resolve()
      }
    }

    xhr.send(null)
  })
}

const blobRe = /\/.*?\/.*?\/blob\/.*/
let oldPathname = null
let oldRepo = null
const main = () => {
  if (!chrome.storage) return
  if (blobRe.test(window.location.pathname) === false) return

  // reset
  if (oldPathname !== window.location.pathname) {
    oldPathname = window.location.pathname
    chrome.storage.onChanged.removeListener(markRead)
    chrome.storage.onChanged.addListener(markRead)
  }
  if (oldRepo !== getRepoName()) {
    oldRepo = getRepoName()
    shaMapping = null
    shaMappingPromise = null
    fetchShaMapping()
  }

  markRead()
  listenClickTd()
}
const debouncedMain = debounce(main)

window.addEventListener('load', debouncedMain)
observe(debouncedMain)

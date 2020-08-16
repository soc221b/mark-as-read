import Axios from 'axios'
import IRepository from './IRepository'
import { wait, globalPromise, onLocationChange } from '../util'

const blobRe = /^https:\/\/github.com\/.*?\/.*?\/blob\/.*$/
const lineHashRe = /^#L\d+(-L\d+)?$/
const numberTdRe = /^L\d+$/
const codeTdRe = /^LC\d+$/

export default class GithubRepository extends IRepository {
  _headToShas = {}
  _lastMousedownEvent = null

  constructor() {
    this._fetchSha()
  }

  async getId() {
    await globalPromise
    return this._headToShas[this._getHead()]
  }

  _fetchSha() {
    wait(this._fetchBranches())
    wait(this._fetchTags())
  }

  _fetchBranches() {
    return Axios.get(`https://api.github.com/repos/${this._getName()}/branches`).then(response => {
      response.data.forEach(item => {
        this._headToShas[item.name] = item.commit.sha
      })
    })
  }

  _fetchTags() {
    return Axios.get(`https://api.github.com/repos/${this._getName()}/tags`).then(response => {
      response.data.forEach(item => {
        this._headToShas[item.name] = item.commit.sha
      })
    })
  }

  _getHead() {
    return window.location.pathname.split('/')[4]
  }

  _getName() {
    return window.location.pathname.split('/').slice(1, 3).join('/')
  }

  onSelect(callback) {
    this._onSelectLines(callback)
    this._onDragLines(callback)
  }

  _onSelectLines(callback) {
    document.querySelector('table').addEventListener('click', event => {
      if (numberTdRe.test(event.srcElement.id) === false) return
      if (blobRe.test(window.location.href) === false) return
      if (lineHashRe.test(window.location.hash) === false) return

      const range = window.location.hash.slice(1).split('-')
      const startRowIndex = parseInt(range[0].slice(1), 10)
      const endRowIndex = parseInt((range[1] || range[0]).slice(1), 10)

      callback({
        startRowIndex,
        endRowIndex,
        startColumnIndex: 0,
        endColumnIndex: Infinity,
      })
    })
  }

  _onDragLines(callback) {
    document.querySelector('table').addEventListener('mousedown', event => {
      if (blobRe.test(window.location.href) === false) return
      if (codeTdRe.test(event.srcElement.id) === false) {
        this._lastMousedownEvent = null
        return
      }

      this._lastMousedownEvent = event
    })

    document.querySelector('table').addEventListener('mouseup', event => {
      if (blobRe.test(window.location.href) === false) return
      if (codeTdRe.test(event.srcElement.id) === false) return
      if (this._lastMousedownEvent === null) return

      callback({
        startRowIndex: this._lastMousedownEvent.id.slice(2), // remove 'LC' for 'LC1'
        endRowIndex: event.srcElement.id.slice(2),
        startColumnIndex: 0,
        endColumnIndex: Infinity,
      })
      this._lastMousedownEvent = null
    })
  }
}

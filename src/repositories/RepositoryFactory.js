import GithubRepository from './GithubRepository'

export default function createRepository() {
  if (window.location.hostname === 'github.com') return new GithubRepository()
  else return null
}

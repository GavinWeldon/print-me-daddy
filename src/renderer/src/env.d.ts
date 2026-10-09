import type { PmdApi } from '../../shared/types'

declare global {
  interface Window {
    pmd: PmdApi
  }
}

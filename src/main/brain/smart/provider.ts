import type { PrintOptions, SmartStatus } from '../../../shared/types'

/** A file Paige could print, as shown to the smart brain. */
export interface SmartCandidate {
  id: number
  name: string
  folder: string
  modified: string
  /** Start of the first page, for "the one about gears" style requests. */
  text?: string
}

export interface SmartRequest {
  request: string
  hostName: string
  candidates: SmartCandidate[]
}

/** What the smart brain decided. Always checked before use. */
export interface SmartPlan {
  /** Candidate ids, in print order. */
  files: number[]
  /** Only the settings the person actually asked for. */
  settings: Partial<PrintOptions>
  /** They want everything combined into one PDF. */
  merge: boolean
  /** Paige's in-character reply. */
  reply: string
  /** The brain isn't sure it understood. */
  unsure: boolean
}

/**
 * Anything that can plan a print job from a request. Today that's Claude Code;
 * another provider can be added by implementing this interface.
 */
export interface SmartProvider {
  readonly name: string
  status(refresh?: boolean): Promise<SmartStatus>
  plan(request: SmartRequest): Promise<SmartPlan>
}

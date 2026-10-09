import { randomUUID } from 'crypto'
import type { ChatMessage, ChatState, HostState } from '../shared/types'

const MAX_MESSAGES = 200

/** Holds the conversation in one place so the full window and the quick bar stay in sync. */
export class Chat {
  private state: ChatState = { messages: [], hostState: 'idle' }

  constructor(private readonly onChange: (state: ChatState) => void) {}

  get(): ChatState {
    return this.state
  }

  add(from: ChatMessage['from'], text: string): void {
    const message: ChatMessage = { id: randomUUID(), from, text, ts: Date.now() }
    this.state = { ...this.state, messages: [...this.state.messages, message].slice(-MAX_MESSAGES) }
    this.onChange(this.state)
  }

  setHostState(hostState: HostState): void {
    this.state = { ...this.state, hostState }
    this.onChange(this.state)
  }
}

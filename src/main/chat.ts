import { randomUUID } from 'crypto'
import type { ChatMessage, ChatState, HostState, PrintJob } from '../shared/types'

const MAX_MESSAGES = 200

/** Holds the conversation (and its print jobs) in one place so the full window and the quick bar stay in sync. */
export class Chat {
  private state: ChatState = { messages: [], hostState: 'idle', jobs: {} }

  constructor(private readonly onChange: (state: ChatState) => void) {}

  get(): ChatState {
    return this.state
  }

  add(from: ChatMessage['from'], text: string, job?: PrintJob): void {
    const message: ChatMessage = { id: randomUUID(), from, text, ts: Date.now(), jobId: job?.id }
    const messages = [...this.state.messages, message].slice(-MAX_MESSAGES)
    // Forget jobs whose card has scrolled out of the history.
    const live = new Set(messages.map((m) => m.jobId).filter(Boolean))
    const jobs = Object.fromEntries(Object.entries({ ...this.state.jobs, ...(job ? { [job.id]: job } : {}) }).filter(([id]) => live.has(id)))
    this.state = { ...this.state, messages, jobs }
    this.onChange(this.state)
  }

  job(id: string): PrintJob | undefined {
    return this.state.jobs[id]
  }

  updateJob(id: string, change: (job: PrintJob) => PrintJob): void {
    const current = this.state.jobs[id]
    if (!current) return
    this.state = { ...this.state, jobs: { ...this.state.jobs, [id]: change(current) } }
    this.onChange(this.state)
  }

  setHostState(hostState: HostState): void {
    this.state = { ...this.state, hostState }
    this.onChange(this.state)
  }
}

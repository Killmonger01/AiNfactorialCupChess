import type { PieceType, Square } from './types'

// ─────────────────────────────────────────────
// UCI move string → board coordinates
// ─────────────────────────────────────────────

export function uciMoveToSquares(uci: string): {
  from: Square
  to: Square
  promotion?: PieceType
} {
  // uci format: "e2e4" or "e7e8q" (promotion)
  const fromCol = uci.charCodeAt(0) - 97   // 'a'=0 … 'h'=7
  const fromRow = 8 - parseInt(uci[1])     // '1'→7, '8'→0
  const toCol   = uci.charCodeAt(2) - 97
  const toRow   = 8 - parseInt(uci[3])

  let promotion: PieceType | undefined
  if (uci.length >= 5) {
    const promoMap: Record<string, PieceType> = {
      q: 'queen', r: 'rook', b: 'bishop', n: 'knight',
    }
    promotion = promoMap[uci[4].toLowerCase()]
  }

  return { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol }, promotion }
}

// ─────────────────────────────────────────────
// Stockfish engine (Web Worker + UCI protocol)
// ─────────────────────────────────────────────

export class StockfishEngine {
  private worker: Worker | null = null
  private isReady = false
  private initPromise: Promise<void> | null = null
  private moveResolve: ((move: string) => void) | null = null
  private moveReject: ((err: Error) => void) | null = null

  /** Load the worker and wait for readyok. Safe to call multiple times. */
  init(): Promise<void> {
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise<void>((resolve, reject) => {
      try {
        this.worker = new Worker('/stockfish.js')
      } catch {
        reject(new Error('Failed to create Stockfish worker'))
        return
      }

      this.worker.onerror = (err) => {
        reject(new Error(`Stockfish worker error: ${err.message}`))
      }

      this.worker.onmessage = (e: MessageEvent) => {
        const msg: string =
          typeof e.data === 'string' ? e.data : String(e.data ?? '')
        this.handleMessage(msg, resolve)
      }

      // Start UCI handshake
      this.worker.postMessage('uci')
    })

    return this.initPromise
  }

  private handleMessage(msg: string, resolveInit?: () => void): void {
    if (msg === 'uciok') {
      this.worker!.postMessage('isready')
      return
    }

    if (msg === 'readyok') {
      this.isReady = true
      resolveInit?.()
      return
    }

    if (msg.startsWith('bestmove')) {
      // "bestmove e2e4 ponder e7e5" or "bestmove (none)"
      const parts = msg.split(' ')
      const move = parts[1]
      if (move && move !== '(none)') {
        this.moveResolve?.(move)
      } else {
        this.moveReject?.(new Error('Stockfish returned no legal move'))
      }
      this.moveResolve = null
      this.moveReject = null
    }
  }

  /** Request the best move for the given FEN at the given Skill Level (0-20). */
  async getBestMove(fen: string, skillLevel: number): Promise<string> {
    await this.init()
    if (!this.worker || !this.isReady) {
      throw new Error('Stockfish engine is not ready')
    }

    return new Promise<string>((resolve, reject) => {
      this.moveResolve = resolve
      this.moveReject = reject

      this.worker!.postMessage(`setoption name Skill Level value ${skillLevel}`)
      this.worker!.postMessage(`position fen ${fen}`)
      this.worker!.postMessage('go movetime 1000')
    })
  }

  /** Terminate the worker and reset state. */
  destroy(): void {
    this.moveReject?.(new Error('Engine destroyed'))
    this.worker?.terminate()
    this.worker = null
    this.isReady = false
    this.initPromise = null
    this.moveResolve = null
    this.moveReject = null
  }
}

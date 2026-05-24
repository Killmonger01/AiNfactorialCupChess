'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  boardToFEN,
  createInitialGameState,
  getLegalMoves,
  movePiece,
} from '@/lib/chess'
import { StockfishEngine, uciMoveToSquares } from '@/lib/stockfish'
import type { Color, GameState, HistoryEntry, Move, PieceType, Square } from '@/lib/types'

const STORAGE_KEY = 'chess_game_state_v2'

export type GameMode = 'pvp' | 'ai'

interface ChessUIState {
  gameState: GameState
  history: HistoryEntry[]
  selectedSquare: Square | null
  legalMoves: Square[]
  lastMove: Move | null
  mode: GameMode
  skillLevel: number
  playerColor: 'white' | 'black'
}

type Action =
  | { type: 'SELECT'; square: Square }
  | { type: 'MOVE'; from: Square; to: Square; promotionPiece?: PieceType }
  | { type: 'UNDO' }
  | { type: 'NEW_GAME'; mode: GameMode; skillLevel: number; playerColor: 'white' | 'black' }
  | { type: 'RESTORE'; state: ChessUIState }
  | { type: 'RESIGN'; resigningColor: Color }

function makeInitialState(mode: GameMode = 'pvp', skillLevel = 10, playerColor: 'white' | 'black' = 'white'): ChessUIState {
  return {
    gameState: createInitialGameState(),
    history: [],
    selectedSquare: null,
    legalMoves: [],
    lastMove: null,
    mode,
    skillLevel,
    playerColor,
  }
}

function reducer(state: ChessUIState, action: Action): ChessUIState {
  switch (action.type) {
    case 'RESTORE':
      return action.state

    case 'NEW_GAME':
      return makeInitialState(action.mode, action.skillLevel, action.playerColor)

    case 'SELECT': {
      const { square } = action
      const { gameState, selectedSquare, mode, playerColor } = state

      // Block clicks when it's the AI's turn
      if (mode === 'ai' && gameState.currentTurn !== playerColor) return state

      // Deselect if same square clicked again
      if (selectedSquare &&
          selectedSquare.row === square.row &&
          selectedSquare.col === square.col) {
        return { ...state, selectedSquare: null, legalMoves: [] }
      }

      const piece = gameState.board[square.row][square.col]

      // If a piece is selected and user clicks a legal destination → move
      if (selectedSquare) {
        const isLegal = state.legalMoves.some(
          m => m.row === square.row && m.col === square.col
        )
        if (isLegal) {
          return reducer(state, { type: 'MOVE', from: selectedSquare, to: square })
        }
      }

      // Select own piece
      if (piece &&
          piece.color === gameState.currentTurn &&
          !gameState.isCheckmate &&
          !gameState.isStalemate) {
        const legal = getLegalMoves(gameState.board, square, gameState)
        return { ...state, selectedSquare: square, legalMoves: legal }
      }

      return { ...state, selectedSquare: null, legalMoves: [] }
    }

    case 'MOVE': {
      const { from, to, promotionPiece } = action
      const { gameState, history } = state
      const stateBefore = gameState

      const { gameState: newGameState, move } = movePiece(
        gameState.board,
        from,
        to,
        gameState,
        promotionPiece ?? 'queen',
      )

      return {
        ...state,
        gameState: newGameState,
        history: [...history, { move, stateBefore }],
        selectedSquare: null,
        legalMoves: [],
        lastMove: move,
      }
    }

    case 'UNDO': {
      const { history, mode } = state
      if (history.length === 0) return state

      // In AI mode undo 2 half-moves so the human gets their turn back
      const undoCount = mode === 'ai' ? Math.min(2, history.length) : 1
      const targetIdx = history.length - undoCount
      const prev = history[targetIdx]

      return {
        ...state,
        gameState: prev.stateBefore,
        history: history.slice(0, targetIdx),
        selectedSquare: null,
        legalMoves: [],
        lastMove: targetIdx >= 1 ? history[targetIdx - 1].move : null,
      }
    }

    case 'RESIGN': {
      const opponent: Color = action.resigningColor === 'white' ? 'black' : 'white'
      return {
        ...state,
        gameState: {
          ...state.gameState,
          isCheckmate: true,
          winner: opponent,
          isResigned: true,
          resignedBy: action.resigningColor,
        },
        selectedSquare: null,
        legalMoves: [],
      }
    }

    default:
      return state
  }
}

export function useChess() {
  const [state, dispatch] = useReducer(reducer, undefined, () => makeInitialState())
  const [aiThinking, setAiThinking] = useState(false)
  const [engineReady, setEngineReady] = useState(false)

  const engineRef = useRef<StockfishEngine | null>(null)
  // Monotonic counter used to discard stale AI requests after undo/new-game
  const aiRequestRef = useRef(0)

  // ── Restore from localStorage once on mount ─────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: ChessUIState = JSON.parse(saved)
        dispatch({ type: 'RESTORE', state: parsed })
      }
    } catch {
      // ignore corrupt data
    }
  }, [])

  // ── Persist on every state change ───────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // ignore storage errors
    }
  }, [state])

  // ── Stockfish engine lifecycle ───────────────────────────────────────────
  useEffect(() => {
    if (state.mode !== 'ai') {
      engineRef.current?.destroy()
      engineRef.current = null
      setEngineReady(false)
      return
    }

    const engine = new StockfishEngine()
    engineRef.current = engine
    setEngineReady(false)

    engine
      .init()
      .then(() => {
        if (engineRef.current === engine) setEngineReady(true)
      })
      .catch((e: unknown) => console.error('Stockfish init failed:', e))

    return () => {
      engine.destroy()
      if (engineRef.current === engine) {
        engineRef.current = null
        setEngineReady(false)
      }
    }
  }, [state.mode])

  // ── Trigger AI move when it is black's turn ─────────────────────────────
  useEffect(() => {
    const { gameState, mode, skillLevel, history } = state

    if (!engineReady || !engineRef.current) return
    if (mode !== 'ai') return
    if (gameState.currentTurn === state.playerColor) return  // human's turn
    if (gameState.isCheckmate || gameState.isStalemate) return
    if (aiThinking) return

    const engine = engineRef.current
    const requestId = ++aiRequestRef.current
    const fen = boardToFEN(
      gameState.board,
      gameState,
      0,
      Math.floor(history.length / 2) + 1,
    )

    setAiThinking(true)

    engine
      .getBestMove(fen, skillLevel)
      .then((uciMove) => {
        if (requestId !== aiRequestRef.current) return
        const { from, to, promotion } = uciMoveToSquares(uciMove)
        dispatch({ type: 'MOVE', from, to, promotionPiece: promotion })
      })
      .catch((e: unknown) => console.error('Stockfish move error:', e))
      .finally(() => {
        if (requestId === aiRequestRef.current) setAiThinking(false)
      })
  // gameState object reference changes after every move — that is the intended trigger
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.gameState, state.mode, state.skillLevel, engineReady, aiThinking])

  // ── Public callbacks ─────────────────────────────────────────────────────
  const handleSquareClick = useCallback((square: Square) => {
    dispatch({ type: 'SELECT', square })
  }, [])

  const undoMove = useCallback(() => {
    aiRequestRef.current++
    setAiThinking(false)
    dispatch({ type: 'UNDO' })
  }, [])

  const newGame = useCallback((mode: GameMode = 'pvp', skillLevel = 10, playerColor: 'white' | 'black' = 'white') => {
    aiRequestRef.current++
    setAiThinking(false)
    dispatch({ type: 'NEW_GAME', mode, skillLevel, playerColor })
  }, [])

  const resign = useCallback(() => {
    const resigningColor: Color = state.mode === 'ai'
      ? state.playerColor
      : state.gameState.currentTurn
    aiRequestRef.current++
    setAiThinking(false)
    dispatch({ type: 'RESIGN', resigningColor })
  }, [state.mode, state.playerColor, state.gameState.currentTurn])

  return {
    gameState:      state.gameState,
    history:        state.history,
    selectedSquare: state.selectedSquare,
    legalMoves:     state.legalMoves,
    lastMove:       state.lastMove,
    mode:           state.mode,
    skillLevel:     state.skillLevel,
    playerColor:    state.playerColor,
    movesCount:     state.history.length,
    aiThinking,
    engineReady,
    handleSquareClick,
    undoMove,
    newGame,
    resign,
  }
}

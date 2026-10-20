import Modal from './Modal';
import { DIFFICULTIES, GAME_TYPES } from '../sudoku/types';
import { MAX_SESSIONS, formatTime } from '../game/model';
import type { GameController } from '../hooks/useGameController';
const capitalize = (text: string) => text[0].toUpperCase() + text.slice(1);
export default function GameDialogs({
  controller,
}: {
  controller: GameController;
}) {
  const {
    state,
    game,
    dialog,
    cancelGeneration,
    startNewGame,
    closeDialog,
    openDialog,
    load,
    deleteGame,
    deleteOthers,
  } = controller;
  const generation =
    controller.generation.status === 'idle' ? null : controller.generation;
  return (
    <>
      {generation && (
        <Modal
          title={
            generation.status === 'running'
              ? 'Generating puzzle'
              : 'Could not start a game'
          }
          onClose={cancelGeneration}
        >
          {generation.status === 'running' ? (
            <>
              <div className="loading-spinner" aria-hidden="true" />
              <p role="status">
                Preparing your {generation.settings.type.toLowerCase()}…
              </p>
            </>
          ) : (
            <p role="alert">{generation.error}</p>
          )}
          <div className="confirm-footer">
            <button
              type="button"
              className="confirm-btn cancel"
              onClick={cancelGeneration}
            >
              Cancel
            </button>
            {generation.status === 'failed' && (
              <button
                type="button"
                className="confirm-btn primary"
                onClick={() =>
                  void startNewGame(
                    generation.settings.difficulty,
                    generation.settings.type,
                  )
                }
              >
                Try again
              </button>
            )}
          </div>
        </Modal>
      )}
      {dialog?.kind === 'difficulty' && (
        <Modal title="Difficulty" onClose={closeDialog}>
          <p className="modal-description">Starts a new game.</p>
          {DIFFICULTIES.map((difficulty) => (
            <button
              type="button"
              className="modal-btn"
              key={difficulty}
              onClick={() =>
                void startNewGame(difficulty, game?.type ?? 'Standard 9x9')
              }
            >
              {capitalize(difficulty)}
            </button>
          ))}
        </Modal>
      )}
      {dialog?.kind === 'type' && (
        <Modal title="Game type" onClose={closeDialog}>
          {GAME_TYPES.map((type) => (
            <button
              type="button"
              className="modal-btn"
              key={type}
              onClick={() =>
                void startNewGame(game?.difficulty ?? 'easy', type)
              }
            >
              {type}
            </button>
          ))}
        </Modal>
      )}
      {dialog?.kind === 'history' && (
        <Modal title="History" onClose={closeDialog}>
          <div className="history-toolbar">
            <p>
              {state.sessions.length} / {MAX_SESSIONS} saved games
            </p>
            <button
              type="button"
              className="delete-others"
              disabled={state.sessions.length < 2}
              onClick={() => openDialog({ kind: 'deleteOthers' })}
            >
              Delete others
            </button>
          </div>
          <div className="history-list">
            {state.sessions.length === 0 ? (
              <p>No history yet</p>
            ) : (
              [...state.sessions]
                .sort((a, b) =>
                  a.id === state.activeGameId
                    ? -1
                    : b.id === state.activeGameId
                      ? 1
                      : b.lastPlayed - a.lastPlayed,
                )
                .map((session) => (
                  <div
                    key={session.id}
                    className={`history-item ${session.id === state.activeGameId ? 'active' : ''}`}
                  >
                    <button
                      type="button"
                      className="history-load"
                      aria-current={
                        session.id === state.activeGameId ? 'true' : undefined
                      }
                      onClick={() => load(session.id)}
                    >
                      <span className="history-main-row">
                        <span className="history-type">{session.type}</span>
                        <span className="history-diff">
                          {capitalize(session.difficulty)}
                        </span>
                        <span
                          className={`history-status ${session.gameStatus === 'won' ? 'completed' : 'uncompleted'}`}
                        >
                          {session.gameStatus === 'won'
                            ? 'Completed'
                            : 'In progress'}
                        </span>
                      </span>
                      <span className="history-time">
                        {formatTime(session.elapsedMs)} ·{' '}
                        {new Date(session.createdAt).toLocaleString([], {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="trash-btn"
                      aria-label={`Delete ${session.type} game`}
                      onClick={() =>
                        openDialog({ kind: 'delete', id: session.id })
                      }
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        aria-hidden="true"
                      >
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                ))
            )}
          </div>
        </Modal>
      )}
      {(dialog?.kind === 'delete' || dialog?.kind === 'deleteOthers') && (
        <Modal
          title={
            dialog.kind === 'delete' ? 'Delete game?' : 'Delete other games?'
          }
          onClose={closeDialog}
        >
          <p className="modal-description">
            {dialog.kind === 'delete'
              ? 'Remove this saved game from this browser?'
              : 'Remove all saved games except the current one?'}
          </p>
          <div className="confirm-footer">
            <button
              type="button"
              className="confirm-btn cancel"
              onClick={closeDialog}
            >
              Cancel
            </button>
            <button
              type="button"
              className="confirm-btn confirm"
              onClick={() => {
                if (dialog.kind === 'delete') deleteGame(dialog.id);
                else {
                  deleteOthers();
                }
              }}
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

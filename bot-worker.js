self.importScripts('chess-logic.js', 'bot-ai.js');

self.onmessage = function (event) {
    const payload = event.data || {};
    const requestId = payload.requestId;

    try {
        if (!self.ChessLogic || !self.ChessBotAI) {
            throw new Error('Worker dependencies are unavailable.');
        }

        const state = self.ChessLogic.createStateSnapshot(payload.stateSnapshot);
        const botColor = payload.botColor || 'b';

        const adapters = {
            getAllLegalMovesWithContext: (color) => self.ChessLogic.getAllLegalMovesWithContext(state, color),
            isInCheck: (color) => self.ChessLogic.isInCheck(state, color),
            getBoardState: () => state.board,
            getKingPositions: () => ({
                white: { ...state.whiteKingPos },
                black: { ...state.blackKingPos }
            }),
            createStateSnapshot: () => self.ChessLogic.createStateSnapshot(state),
            restoreStateSnapshot: (snapshot) => self.ChessLogic.restoreStateSnapshot(state, snapshot),
            applySimulatedMove: (move) => {
                self.ChessLogic.applyMove(state, move, {
                    switchPlayer: true,
                    recordPosition: false
                });
            }
        };

        const move = self.ChessBotAI.chooseMove({
            difficulty: payload.difficulty || 'easy',
            botColor,
            repetitionCounts: payload.repetitionCounts || {},
            adapters
        });

        self.postMessage({ requestId, move: move || null });
    } catch (error) {
        self.postMessage({
            requestId,
            move: null,
            error: error && error.message ? error.message : 'Worker move selection failed.'
        });
    }
};

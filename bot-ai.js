(function (global) {
    const PIECE_VALUES = { K: 0, Q: 9, R: 5, B: 3, N: 3, P: 1 };
    const THINK_TIME_MS = { easy: 200, medium: 300, hard: 350, expert: 450 };
    const MATE_SCORE = 100000;
    const INF = 1000000000;

    function getOpponentColor(color) {
        return color === 'w' ? 'b' : 'w';
    }

    function getPositionKey(board, sideToMove) {
        const rows = [];
        for (let r = 0; r < 8; r++) {
            rows.push(board[r].map(cell => cell || '..').join(','));
        }
        return `${sideToMove}|${rows.join('/')}`;
    }

    function countNonKingPieces(board) {
        let count = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (!piece || piece[1] === 'K') continue;
                count++;
            }
        }
        return count;
    }

    function getMaterialScores(board) {
        let white = 0;
        let black = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (!piece) continue;
                const value = (PIECE_VALUES[piece[1]] || 0) * 100;
                if (piece[0] === 'w') white += value;
                else black += value;
            }
        }
        return { white, black };
    }

    function evaluateBoardForColor(board, color, adapters) {
        const material = getMaterialScores(board);
        let score = color === 'w' ? material.white - material.black : material.black - material.white;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (!piece || piece[1] !== 'P') continue;
                const advance = piece[0] === 'w' ? (6 - r) : (r - 1);
                const pawnBonus = advance * 8;
                if (piece[0] === color) score += pawnBonus;
                else score -= pawnBonus;
            }
        }

        const ownMaterial = color === 'w' ? material.white : material.black;
        const oppMaterial = color === 'w' ? material.black : material.white;
        const materialLead = ownMaterial - oppMaterial;
        if (materialLead > 300 && oppMaterial <= 600 && adapters.getKingPositions) {
            const kings = adapters.getKingPositions();
            const ownKing = color === 'w' ? kings.white : kings.black;
            const enemyKing = color === 'w' ? kings.black : kings.white;
            if (ownKing && enemyKing) {
                const edgeDistance = Math.min(
                    enemyKing.row,
                    7 - enemyKing.row,
                    enemyKing.col,
                    7 - enemyKing.col
                );
                const pushToEdgeBonus = (3 - edgeDistance) * 25;
                const kingDistance = Math.abs(ownKing.row - enemyKing.row) + Math.abs(ownKing.col - enemyKing.col);
                const kingApproachBonus = (14 - kingDistance) * 4;
                score += pushToEdgeBonus + kingApproachBonus;
            }
        }

        return score;
    }

    function moveOrderingScore(move, sideToMove) {
        let score = 0;
        if (move.captured) {
            const capturedValue = (PIECE_VALUES[move.captured[1]] || 0) * 100;
            const moverValue = (PIECE_VALUES[move.piece[1]] || 0) * 100;
            score += capturedValue * 10 - moverValue;
        }
        if (move.promotionChoice) score += 9000;
        if (move.piece && move.piece[1] === 'P') {
            const pawnAdvance = sideToMove === 'w'
                ? (move.fromRow - move.toRow)
                : (move.toRow - move.fromRow);
            score += pawnAdvance * 15;
        }
        return score;
    }

    function orderMoves(moves, sideToMove) {
        return [...moves].sort((a, b) => moveOrderingScore(b, sideToMove) - moveOrderingScore(a, sideToMove));
    }

    function shouldStopSearch(context) {
        if (!context || !context.deadline) return false;
        context.nodes++;
        if ((context.nodes & 1023) !== 0) return false;
        if (Date.now() > context.deadline) {
            context.timedOut = true;
            return true;
        }
        return false;
    }

    function minimax(depth, sideToMove, maximizingColor, alpha, beta, adapters, context) {
        if (shouldStopSearch(context)) {
            return evaluateBoardForColor(adapters.getBoardState(), maximizingColor, adapters);
        }

        const legalMoves = adapters.getAllLegalMovesWithContext(sideToMove);
        if (depth === 0 || legalMoves.length === 0) {
            if (legalMoves.length === 0) {
                if (adapters.isInCheck(sideToMove)) {
                    const plyFromRoot = context ? (context.rootDepth - depth) : 0;
                    const mateValue = MATE_SCORE - plyFromRoot;
                    return sideToMove === maximizingColor ? -mateValue : mateValue;
                }
                return 0;
            }
            return evaluateBoardForColor(adapters.getBoardState(), maximizingColor, adapters);
        }

        const isMaximizing = sideToMove === maximizingColor;
        let bestScore = isMaximizing ? -Infinity : Infinity;
        const orderedMoves = orderMoves(legalMoves, sideToMove);

        for (const move of orderedMoves) {
            if (context && context.timedOut) break;
            const snapshot = adapters.createStateSnapshot();
            adapters.applySimulatedMove(move);
            const score = minimax(
                depth - 1,
                getOpponentColor(sideToMove),
                maximizingColor,
                alpha,
                beta,
                adapters,
                context
            );
            adapters.restoreStateSnapshot(snapshot);

            if (isMaximizing) {
                bestScore = Math.max(bestScore, score);
                alpha = Math.max(alpha, bestScore);
            } else {
                bestScore = Math.min(bestScore, score);
                beta = Math.min(beta, bestScore);
            }
            if (beta <= alpha) break;
        }
        return bestScore;
    }

    function pickBestMoveByDepth(
        legalMoves,
        depth,
        botColor,
        adapters,
        context,
        allowTieRandomness,
        repetitionPenalty
    ) {
        let bestScore = -INF;
        let bestMove = null;
        const candidateMoves = orderMoves(legalMoves, botColor);

        for (const move of candidateMoves) {
            if (context && context.timedOut) break;
            const snapshot = adapters.createStateSnapshot();
            adapters.applySimulatedMove(move);
            const score = minimax(
                Math.max(0, depth - 1),
                getOpponentColor(botColor),
                botColor,
                -INF,
                INF,
                adapters,
                context
            );

            if (repetitionPenalty > 0 && context && context.repetitionCounts) {
                const nextSide = getOpponentColor(botColor);
                const nextPositionKey = getPositionKey(adapters.getBoardState(), nextSide);
                const seenCount = context.repetitionCounts[nextPositionKey] || 0;
                if (seenCount > 0) {
                    score -= repetitionPenalty * seenCount;
                }
            }
            adapters.restoreStateSnapshot(snapshot);

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            } else if (allowTieRandomness && Math.abs(score - bestScore) < 1e-9 && Math.random() < 0.35) {
                bestMove = move;
            }
        }

        return bestMove;
    }

    function pickRandomMove(moves) {
        if (!moves.length) return null;
        return moves[Math.floor(Math.random() * moves.length)];
    }

    function chooseMoveWithIterativeDeepening(params) {
        const {
            legalMoves,
            botColor,
            adapters,
            maxDepth,
            deadlineMs,
            allowTieRandomness,
            repetitionCounts,
            repetitionPenalty
        } = params;

        const deadline = Date.now() + deadlineMs;
        let bestMove = orderMoves(legalMoves, botColor)[0] || legalMoves[0] || null;

        for (let depth = 1; depth <= maxDepth; depth++) {
            const searchContext = {
                deadline,
                timedOut: false,
                nodes: 0,
                rootDepth: depth,
                repetitionCounts
            };

            const candidate = pickBestMoveByDepth(
                legalMoves,
                depth,
                botColor,
                adapters,
                searchContext,
                allowTieRandomness,
                repetitionPenalty
            );

            if (!searchContext.timedOut && candidate) {
                bestMove = candidate;
            }
            if (searchContext.timedOut) break;
        }

        return bestMove;
    }

    function chooseMove(params) {
        const difficulty = params.difficulty || 'easy';
        const botColor = params.botColor || 'b';
        const adapters = params.adapters;
        const legalMoves = adapters.getAllLegalMovesWithContext(botColor);
        const repetitionCounts = params.repetitionCounts || {};
        if (!legalMoves.length) return null;

        if (difficulty === 'easy') return pickRandomMove(legalMoves);
        if (difficulty === 'medium') {
            return chooseMoveWithIterativeDeepening({
                legalMoves,
                botColor,
                adapters,
                maxDepth: 3,
                deadlineMs: 700,
                allowTieRandomness: true,
                repetitionCounts,
                repetitionPenalty: 15
            });
        }

        const pieceCount = countNonKingPieces(adapters.getBoardState());
        if (difficulty === 'hard') {
            const hardDepth = pieceCount <= 10 ? 5 : 4;
            return chooseMoveWithIterativeDeepening({
                legalMoves,
                botColor,
                adapters,
                maxDepth: hardDepth,
                deadlineMs: 1600,
                allowTieRandomness: false,
                repetitionCounts,
                repetitionPenalty: 35
            });
        }

        const expertDepth = pieceCount <= 8 ? 6 : 5;
        return chooseMoveWithIterativeDeepening({
            legalMoves,
            botColor,
            adapters,
            maxDepth: expertDepth,
            deadlineMs: 2400,
            allowTieRandomness: false,
            repetitionCounts,
            repetitionPenalty: 80
        });
    }

    function getThinkTime(difficulty) {
        return THINK_TIME_MS[difficulty] || THINK_TIME_MS.easy;
    }

    global.ChessBotAI = {
        chooseMove,
        getThinkTime
    };
})(window);

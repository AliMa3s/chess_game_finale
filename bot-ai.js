(function (global) {
    const PIECE_VALUES = { K: 0, Q: 9, R: 5, B: 3, N: 3, P: 1 };
    const THINK_TIME_MS = { easy: 200, medium: 300, hard: 350, expert: 450 };
    const MATE_SCORE = 100000;
    const INF = 1000000000;

    const PST = {
        P: [
            0, 0, 0, 0, 0, 0, 0, 0,
            50, 50, 50, 50, 50, 50, 50, 50,
            10, 10, 20, 30, 30, 20, 10, 10,
            5, 5, 10, 25, 25, 10, 5, 5,
            0, 0, 0, 20, 20, 0, 0, 0,
            5, -5, -10, 0, 0, -10, -5, 5,
            5, 10, 10, -20, -20, 10, 10, 5,
            0, 0, 0, 0, 0, 0, 0, 0
        ],
        N: [
            -50, -40, -30, -30, -30, -30, -40, -50,
            -40, -20, 0, 5, 5, 0, -20, -40,
            -30, 5, 10, 15, 15, 10, 5, -30,
            -30, 0, 15, 20, 20, 15, 0, -30,
            -30, 5, 15, 20, 20, 15, 5, -30,
            -30, 0, 10, 15, 15, 10, 0, -30,
            -40, -20, 0, 0, 0, 0, -20, -40,
            -50, -40, -30, -30, -30, -30, -40, -50
        ],
        B: [
            -20, -10, -10, -10, -10, -10, -10, -20,
            -10, 0, 0, 0, 0, 0, 0, -10,
            -10, 0, 5, 10, 10, 5, 0, -10,
            -10, 5, 5, 10, 10, 5, 5, -10,
            -10, 0, 10, 10, 10, 10, 0, -10,
            -10, 10, 10, 10, 10, 10, 10, -10,
            -10, 5, 0, 0, 0, 0, 5, -10,
            -20, -10, -10, -10, -10, -10, -10, -20
        ],
        R: [
            0, 0, 0, 0, 0, 0, 0, 0,
            5, 10, 10, 10, 10, 10, 10, 5,
            -5, 0, 0, 0, 0, 0, 0, -5,
            -5, 0, 0, 0, 0, 0, 0, -5,
            -5, 0, 0, 0, 0, 0, 0, -5,
            -5, 0, 0, 0, 0, 0, 0, -5,
            -5, 0, 0, 0, 0, 0, 0, -5,
            0, 0, 0, 5, 5, 0, 0, 0
        ],
        Q: [
            -20, -10, -10, -5, -5, -10, -10, -20,
            -10, 0, 0, 0, 0, 0, 0, -10,
            -10, 0, 5, 5, 5, 5, 0, -10,
            -5, 0, 5, 5, 5, 5, 0, -5,
            0, 0, 5, 5, 5, 5, 0, -5,
            -10, 5, 5, 5, 5, 5, 0, -10,
            -10, 0, 5, 0, 0, 0, 0, -10,
            -20, -10, -10, -5, -5, -10, -10, -20
        ],
        K_MG: [
            -30, -40, -40, -50, -50, -40, -40, -30,
            -30, -40, -40, -50, -50, -40, -40, -30,
            -30, -40, -40, -50, -50, -40, -40, -30,
            -30, -40, -40, -50, -50, -40, -40, -30,
            -20, -30, -30, -40, -40, -30, -30, -20,
            -10, -20, -20, -20, -20, -20, -20, -10,
            20, 20, 0, 0, 0, 0, 20, 20,
            20, 30, 10, 0, 0, 10, 30, 20
        ],
        K_EG: [
            -50, -40, -30, -20, -20, -30, -40, -50,
            -30, -20, -10, 0, 0, -10, -20, -30,
            -30, -10, 20, 30, 30, 20, -10, -30,
            -30, -10, 30, 40, 40, 30, -10, -30,
            -30, -10, 30, 40, 40, 30, -10, -30,
            -30, -10, 20, 30, 30, 20, -10, -30,
            -30, -30, 0, 0, 0, 0, -30, -30,
            -50, -30, -30, -30, -30, -30, -30, -50
        ]
    };

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

    function squareIndexForPiece(piece, row, col) {
        return piece[0] === 'w' ? row * 8 + col : (7 - row) * 8 + col;
    }

    function getPstValue(piece, row, col, nonKingPieceCount) {
        const type = piece[1];
        const tableKey = type === 'K' ? (nonKingPieceCount <= 10 ? 'K_EG' : 'K_MG') : type;
        const table = PST[tableKey];
        if (!table) return 0;
        return table[squareIndexForPiece(piece, row, col)] || 0;
    }

    function evaluateBoardForColor(board, color, adapters) {
        let white = 0;
        let black = 0;
        const nonKingPieceCount = countNonKingPieces(board);

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (!piece) continue;
                const material = (PIECE_VALUES[piece[1]] || 0) * 100;
                const pst = getPstValue(piece, r, c, nonKingPieceCount);
                const pieceScore = material + pst;
                if (piece[0] === 'w') white += pieceScore;
                else black += pieceScore;
            }
        }

        let score = color === 'w' ? white - black : black - white;

        const ownMaterial = color === 'w' ? white : black;
        const oppMaterial = color === 'w' ? black : white;
        const materialLead = ownMaterial - oppMaterial;
        if (materialLead > 300 && oppMaterial <= 700 && adapters.getKingPositions) {
            const kings = adapters.getKingPositions();
            const ownKing = color === 'w' ? kings.white : kings.black;
            const enemyKing = color === 'w' ? kings.black : kings.white;
            if (ownKing && enemyKing) {
                const edgeDistance = Math.min(enemyKing.row, 7 - enemyKing.row, enemyKing.col, 7 - enemyKing.col);
                const pushToEdgeBonus = (3 - edgeDistance) * 20;
                const kingDistance = Math.abs(ownKing.row - enemyKing.row) + Math.abs(ownKing.col - enemyKing.col);
                const kingApproachBonus = (14 - kingDistance) * 3;
                score += pushToEdgeBonus + kingApproachBonus;
            }
        }

        return score;
    }

    function isPromotionMove(move) {
        return !!(move && move.piece && move.piece[1] === 'P' && (move.toRow === 0 || move.toRow === 7));
    }

    function expandPromotionMoves(moves) {
        const expanded = [];
        for (const move of moves || []) {
            if (!isPromotionMove(move)) {
                expanded.push(move);
                continue;
            }
            const base = { ...move };
            ['Q', 'N', 'R', 'B'].forEach(choice => {
                expanded.push({ ...base, promotionChoice: choice });
            });
        }
        return expanded;
    }

    function moveOrderingScore(move, sideToMove) {
        let score = 0;
        if (move.captured) {
            const capturedValue = (PIECE_VALUES[move.captured[1]] || 0) * 100;
            const moverValue = (PIECE_VALUES[move.piece[1]] || 0) * 100;
            score += capturedValue * 12 - moverValue;
        }
        if (move.isCastling) score += 120;
        if (move.promotionChoice) {
            const promotionBonus = { Q: 9000, N: 7800, R: 7200, B: 7000 };
            score += promotionBonus[move.promotionChoice] || 6800;
        }
        if (move.piece && move.piece[1] === 'P') {
            const pawnAdvance = sideToMove === 'w' ? (move.fromRow - move.toRow) : (move.toRow - move.fromRow);
            score += pawnAdvance * 14;
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

    function quiescence(depth, sideToMove, maximizingColor, alpha, beta, adapters, context) {
        if (shouldStopSearch(context)) {
            return evaluateBoardForColor(adapters.getBoardState(), maximizingColor, adapters);
        }

        const standPat = evaluateBoardForColor(adapters.getBoardState(), maximizingColor, adapters);
        const isMaximizing = sideToMove === maximizingColor;

        if (isMaximizing) {
            if (standPat >= beta) return standPat;
            if (standPat > alpha) alpha = standPat;
        } else {
            if (standPat <= alpha) return standPat;
            if (standPat < beta) beta = standPat;
        }

        if (depth <= 0) return standPat;

        const allLegalMoves = expandPromotionMoves(adapters.getAllLegalMovesWithContext(sideToMove));
        const tacticalMoves = allLegalMoves.filter(move => move.captured || move.promotionChoice);
        if (!tacticalMoves.length) return standPat;

        const orderedMoves = orderMoves(tacticalMoves, sideToMove);
        let bestScore = standPat;

        for (const move of orderedMoves) {
            if (context && context.timedOut) break;
            const snapshot = adapters.createStateSnapshot();
            adapters.applySimulatedMove(move);
            const score = quiescence(
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

    function minimax(depth, sideToMove, maximizingColor, alpha, beta, adapters, context) {
        if (shouldStopSearch(context)) {
            return evaluateBoardForColor(adapters.getBoardState(), maximizingColor, adapters);
        }

        const boardKey = getPositionKey(adapters.getBoardState(), sideToMove);
        const ttKey = `${maximizingColor}|${sideToMove}|${depth}|${boardKey}`;
        if (context && context.tt && context.tt.has(ttKey)) {
            return context.tt.get(ttKey);
        }

        const legalMoves = expandPromotionMoves(adapters.getAllLegalMovesWithContext(sideToMove));
        if (depth === 0 || legalMoves.length === 0) {
            let terminalScore;
            if (legalMoves.length === 0) {
                if (adapters.isInCheck(sideToMove)) {
                    const plyFromRoot = context ? (context.rootDepth - depth) : 0;
                    const mateValue = MATE_SCORE - plyFromRoot;
                    terminalScore = sideToMove === maximizingColor ? -mateValue : mateValue;
                } else {
                    terminalScore = 0;
                }
            } else {
                terminalScore = quiescence(
                    context && context.quiescenceDepth ? context.quiescenceDepth : 2,
                    sideToMove,
                    maximizingColor,
                    alpha,
                    beta,
                    adapters,
                    context
                );
            }
            if (context && context.tt) context.tt.set(ttKey, terminalScore);
            return terminalScore;
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

        if (context && context.tt) context.tt.set(ttKey, bestScore);
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
        const candidateMoves = orderMoves(expandPromotionMoves(legalMoves), botColor);

        for (const move of candidateMoves) {
            if (context && context.timedOut) break;
            const snapshot = adapters.createStateSnapshot();
            adapters.applySimulatedMove(move);
            let score = minimax(
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
                if (seenCount > 0) score -= repetitionPenalty * seenCount;
            }

            adapters.restoreStateSnapshot(snapshot);

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            } else if (allowTieRandomness && Math.abs(score - bestScore) < 1e-9 && Math.random() < 0.25) {
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
            repetitionPenalty,
            quiescenceDepth
        } = params;

        const deadline = Date.now() + deadlineMs;
        let bestMove = orderMoves(expandPromotionMoves(legalMoves), botColor)[0] || legalMoves[0] || null;
        const tt = new Map();

        for (let depth = 1; depth <= maxDepth; depth++) {
            const searchContext = {
                deadline,
                timedOut: false,
                nodes: 0,
                rootDepth: depth,
                repetitionCounts,
                quiescenceDepth,
                tt
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

            if (!searchContext.timedOut && candidate) bestMove = candidate;
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

        if (difficulty === 'easy') return pickRandomMove(expandPromotionMoves(legalMoves));
        if (difficulty === 'medium') {
            return chooseMoveWithIterativeDeepening({
                legalMoves,
                botColor,
                adapters,
                maxDepth: 3,
                deadlineMs: 700,
                allowTieRandomness: true,
                repetitionCounts,
                repetitionPenalty: 18,
                quiescenceDepth: 1
            });
        }

        const pieceCount = countNonKingPieces(adapters.getBoardState());
        if (difficulty === 'hard') {
            const hardDepth = pieceCount <= 12 ? 5 : 4;
            return chooseMoveWithIterativeDeepening({
                legalMoves,
                botColor,
                adapters,
                maxDepth: hardDepth,
                deadlineMs: 1700,
                allowTieRandomness: false,
                repetitionCounts,
                repetitionPenalty: 40,
                quiescenceDepth: 2
            });
        }

        const expertDepth = pieceCount <= 10 ? 6 : 5;
        return chooseMoveWithIterativeDeepening({
            legalMoves,
            botColor,
            adapters,
            maxDepth: expertDepth,
            deadlineMs: 2500,
            allowTieRandomness: false,
            repetitionCounts,
            repetitionPenalty: 85,
            quiescenceDepth: 3
        });
    }

    function getThinkTime(difficulty) {
        return THINK_TIME_MS[difficulty] || THINK_TIME_MS.easy;
    }

    global.ChessBotAI = {
        chooseMove,
        getThinkTime
    };
})(typeof window !== 'undefined' ? window : self);

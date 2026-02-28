(function (global) {
    'use strict';

    const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

    function getOpponentColor(color) {
        return color === 'w' ? 'b' : 'w';
    }

    function isValid(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    function cloneBoard(board) {
        return board.map(row => row.slice());
    }

    function clonePosition(position) {
        return position ? { row: position.row, col: position.col } : null;
    }

    function cloneCastlingRights(rights) {
        return {
            wK: !!(rights && rights.wK),
            wQ: !!(rights && rights.wQ),
            bK: !!(rights && rights.bK),
            bQ: !!(rights && rights.bQ),
        };
    }

    function copyBoardInPlace(targetBoard, sourceBoard) {
        if (!Array.isArray(targetBoard) || targetBoard.length !== 8) {
            return cloneBoard(sourceBoard);
        }
        for (let r = 0; r < 8; r++) {
            if (!Array.isArray(targetBoard[r]) || targetBoard[r].length !== 8) {
                targetBoard[r] = Array(8).fill(null);
            }
            for (let c = 0; c < 8; c++) {
                targetBoard[r][c] = sourceBoard[r][c];
            }
        }
        return targetBoard;
    }

    function copyObjectKeysInPlace(targetObject, sourceObject) {
        if (!targetObject || typeof targetObject !== 'object') {
            return { ...(sourceObject || {}) };
        }
        Object.keys(targetObject).forEach(key => {
            delete targetObject[key];
        });
        Object.keys(sourceObject || {}).forEach(key => {
            targetObject[key] = sourceObject[key];
        });
        return targetObject;
    }

    function createInitialBoard() {
        return [
            ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'],
            ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'],
            Array(8).fill(null),
            Array(8).fill(null),
            Array(8).fill(null),
            Array(8).fill(null),
            ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'],
            ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR']
        ];
    }

    function createInitialState() {
        return {
            board: createInitialBoard(),
            currentPlayer: 'w',
            whiteKingPos: { row: 7, col: 4 },
            blackKingPos: { row: 0, col: 4 },
            castlingRights: { wK: true, wQ: true, bK: true, bQ: true },
            enPassantTarget: null,
            halfmoveClock: 0,
            fullmoveNumber: 1,
            positionRepetitionCounts: {}
        };
    }

    function createStateSnapshot(state) {
        return {
            board: cloneBoard(state.board),
            currentPlayer: state.currentPlayer,
            whiteKingPos: clonePosition(state.whiteKingPos),
            blackKingPos: clonePosition(state.blackKingPos),
            castlingRights: cloneCastlingRights(state.castlingRights),
            enPassantTarget: clonePosition(state.enPassantTarget),
            halfmoveClock: state.halfmoveClock,
            fullmoveNumber: state.fullmoveNumber,
            positionRepetitionCounts: { ...(state.positionRepetitionCounts || {}) }
        };
    }

    function restoreStateSnapshot(state, snapshot) {
        state.board = copyBoardInPlace(state.board, snapshot.board);
        state.currentPlayer = snapshot.currentPlayer;
        if (!state.whiteKingPos) state.whiteKingPos = { row: 0, col: 0 };
        if (!state.blackKingPos) state.blackKingPos = { row: 0, col: 0 };
        state.whiteKingPos.row = snapshot.whiteKingPos.row;
        state.whiteKingPos.col = snapshot.whiteKingPos.col;
        state.blackKingPos.row = snapshot.blackKingPos.row;
        state.blackKingPos.col = snapshot.blackKingPos.col;

        if (!state.castlingRights) state.castlingRights = { wK: false, wQ: false, bK: false, bQ: false };
        state.castlingRights.wK = !!snapshot.castlingRights.wK;
        state.castlingRights.wQ = !!snapshot.castlingRights.wQ;
        state.castlingRights.bK = !!snapshot.castlingRights.bK;
        state.castlingRights.bQ = !!snapshot.castlingRights.bQ;

        if (snapshot.enPassantTarget) {
            if (!state.enPassantTarget) state.enPassantTarget = { row: 0, col: 0 };
            state.enPassantTarget.row = snapshot.enPassantTarget.row;
            state.enPassantTarget.col = snapshot.enPassantTarget.col;
        } else {
            state.enPassantTarget = null;
        }

        state.halfmoveClock = snapshot.halfmoveClock;
        state.fullmoveNumber = snapshot.fullmoveNumber;
        state.positionRepetitionCounts = copyObjectKeysInPlace(
            state.positionRepetitionCounts,
            snapshot.positionRepetitionCounts || {}
        );
        return state;
    }

    function getPieceColor(board, row, col) {
        if (!isValid(row, col)) return null;
        const piece = board[row][col];
        return piece ? piece[0] : null;
    }

    function getAlgebraicSquare(row, col) {
        if (!isValid(row, col)) return '??';
        return FILES[col] + RANKS[row];
    }

    function buildCastlingKey(castlingRights) {
        let key = '';
        if (castlingRights.wK) key += 'K';
        if (castlingRights.wQ) key += 'Q';
        if (castlingRights.bK) key += 'k';
        if (castlingRights.bQ) key += 'q';
        return key || '-';
    }

    function canSideCaptureEnPassant(state, sideToMove) {
        const target = state.enPassantTarget;
        if (!target) return false;

        const candidateRow = sideToMove === 'w' ? target.row + 1 : target.row - 1;
        if (!isValid(candidateRow, target.col)) return false;

        const leftCol = target.col - 1;
        const rightCol = target.col + 1;
        const requiredPiece = sideToMove + 'P';
        const board = state.board;

        if (isValid(candidateRow, leftCol) && board[candidateRow][leftCol] === requiredPiece) return true;
        if (isValid(candidateRow, rightCol) && board[candidateRow][rightCol] === requiredPiece) return true;
        return false;
    }

    function getPositionKey(state, sideToMove) {
        const player = sideToMove || state.currentPlayer;
        const rows = [];
        for (let r = 0; r < 8; r++) {
            rows.push(state.board[r].map(cell => cell || '..').join(','));
        }
        const castlingKey = buildCastlingKey(state.castlingRights);
        const enPassantKey = state.enPassantTarget && canSideCaptureEnPassant(state, player)
            ? getAlgebraicSquare(state.enPassantTarget.row, state.enPassantTarget.col)
            : '-';
        return `${player}|${castlingKey}|${enPassantKey}|${rows.join('/')}`;
    }

    function recordCurrentPosition(state) {
        const key = getPositionKey(state, state.currentPlayer);
        state.positionRepetitionCounts[key] = (state.positionRepetitionCounts[key] || 0) + 1;
        return key;
    }

    function getPawnMoves(state, row, col, color, forAttackOnly) {
        const board = state.board;
        const moves = [];
        const direction = color === 'w' ? -1 : 1;

        if (forAttackOnly) {
            const attackCols = [col - 1, col + 1];
            for (const targetCol of attackCols) {
                const targetRow = row + direction;
                if (isValid(targetRow, targetCol)) {
                    moves.push({ row: targetRow, col: targetCol });
                }
            }
            return moves;
        }

        const startRow = color === 'w' ? 6 : 1;
        const oneForwardRow = row + direction;
        if (isValid(oneForwardRow, col) && !board[oneForwardRow][col]) {
            moves.push({ row: oneForwardRow, col: col });

            const twoForwardRow = row + 2 * direction;
            if (row === startRow && isValid(twoForwardRow, col) && !board[twoForwardRow][col]) {
                moves.push({ row: twoForwardRow, col: col, isDoublePawnPush: true });
            }
        }

        const captureOffsets = [-1, 1];
        for (const offset of captureOffsets) {
            const targetRow = row + direction;
            const targetCol = col + offset;
            if (!isValid(targetRow, targetCol)) continue;

            const targetPiece = board[targetRow][targetCol];
            if (targetPiece && targetPiece[0] !== color && targetPiece[1] !== 'K') {
                moves.push({ row: targetRow, col: targetCol, captured: targetPiece });
            }
        }

        const ep = state.enPassantTarget;
        if (ep && row + direction === ep.row && Math.abs(col - ep.col) === 1) {
            const capturedPawn = board[row][ep.col];
            if (capturedPawn && capturedPawn[0] !== color && capturedPawn[1] === 'P') {
                moves.push({
                    row: ep.row,
                    col: ep.col,
                    isEnPassant: true,
                    captured: capturedPawn
                });
            }
        }

        return moves;
    }

    function getSlidingMoves(state, row, col, color, directions, forAttackOnly) {
        const board = state.board;
        const moves = [];
        for (const [dr, dc] of directions) {
            for (let step = 1; step < 8; step++) {
                const targetRow = row + dr * step;
                const targetCol = col + dc * step;
                if (!isValid(targetRow, targetCol)) break;

                const targetPiece = board[targetRow][targetCol];
                if (!targetPiece) {
                    moves.push({ row: targetRow, col: targetCol });
                    continue;
                }

                if (targetPiece[0] === color) break;
                if (!forAttackOnly && targetPiece[1] === 'K') break;

                moves.push({ row: targetRow, col: targetCol, captured: targetPiece });
                break;
            }
        }
        return moves;
    }

    function getKnightMoves(state, row, col, color, forAttackOnly) {
        const board = state.board;
        const moves = [];
        const offsets = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];

        for (const [dr, dc] of offsets) {
            const targetRow = row + dr;
            const targetCol = col + dc;
            if (!isValid(targetRow, targetCol)) continue;

            const targetPiece = board[targetRow][targetCol];
            if (!targetPiece) {
                moves.push({ row: targetRow, col: targetCol });
                continue;
            }
            if (targetPiece[0] === color) continue;
            if (!forAttackOnly && targetPiece[1] === 'K') continue;
            moves.push({ row: targetRow, col: targetCol, captured: targetPiece });
        }

        return moves;
    }

    function canCastle(state, color, side) {
        const board = state.board;
        const homeRow = color === 'w' ? 7 : 0;
        const kingPiece = color + 'K';
        const rookPiece = color + 'R';
        const opponent = getOpponentColor(color);

        if (board[homeRow][4] !== kingPiece) return false;
        if (isInCheck(state, color)) return false;

        if (side === 'king') {
            if (board[homeRow][7] !== rookPiece) return false;
            if (board[homeRow][5] || board[homeRow][6]) return false;
            if (isSquareAttacked(state, homeRow, 5, opponent)) return false;
            if (isSquareAttacked(state, homeRow, 6, opponent)) return false;
            return true;
        }

        if (board[homeRow][0] !== rookPiece) return false;
        if (board[homeRow][1] || board[homeRow][2] || board[homeRow][3]) return false;
        if (isSquareAttacked(state, homeRow, 3, opponent)) return false;
        if (isSquareAttacked(state, homeRow, 2, opponent)) return false;
        return true;
    }

    function getKingMoves(state, row, col, color, forAttackOnly) {
        const board = state.board;
        const moves = [];

        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const targetRow = row + dr;
                const targetCol = col + dc;
                if (!isValid(targetRow, targetCol)) continue;

                const targetPiece = board[targetRow][targetCol];
                if (!targetPiece) {
                    moves.push({ row: targetRow, col: targetCol });
                    continue;
                }
                if (targetPiece[0] === color) continue;
                if (!forAttackOnly && targetPiece[1] === 'K') continue;
                moves.push({ row: targetRow, col: targetCol, captured: targetPiece });
            }
        }

        if (forAttackOnly) return moves;

        const homeRow = color === 'w' ? 7 : 0;
        if (row !== homeRow || col !== 4) return moves;

        const rights = state.castlingRights || {};
        if (color === 'w') {
            if (rights.wK && canCastle(state, color, 'king')) {
                moves.push({ row: homeRow, col: 6, isCastling: true, castleSide: 'king' });
            }
            if (rights.wQ && canCastle(state, color, 'queen')) {
                moves.push({ row: homeRow, col: 2, isCastling: true, castleSide: 'queen' });
            }
        } else {
            if (rights.bK && canCastle(state, color, 'king')) {
                moves.push({ row: homeRow, col: 6, isCastling: true, castleSide: 'king' });
            }
            if (rights.bQ && canCastle(state, color, 'queen')) {
                moves.push({ row: homeRow, col: 2, isCastling: true, castleSide: 'queen' });
            }
        }

        return moves;
    }

    function getPotentialMovesForPiece(state, row, col, forAttackOnly) {
        const board = state.board;
        const piece = board[row][col];
        if (!piece) return [];

        const color = piece[0];
        const type = piece[1];

        switch (type) {
            case 'P': return getPawnMoves(state, row, col, color, !!forAttackOnly);
            case 'R': return getSlidingMoves(state, row, col, color, [[-1, 0], [1, 0], [0, -1], [0, 1]], !!forAttackOnly);
            case 'N': return getKnightMoves(state, row, col, color, !!forAttackOnly);
            case 'B': return getSlidingMoves(state, row, col, color, [[-1, -1], [-1, 1], [1, -1], [1, 1]], !!forAttackOnly);
            case 'Q': return getSlidingMoves(state, row, col, color, [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]], !!forAttackOnly);
            case 'K': return getKingMoves(state, row, col, color, !!forAttackOnly);
            default: return [];
        }
    }

    function isSquareAttacked(state, row, col, attackerColor) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = state.board[r][c];
                if (!piece || piece[0] !== attackerColor) continue;
                const attacks = getPotentialMovesForPiece(state, r, c, true);
                if (attacks.some(move => move.row === row && move.col === col)) {
                    return true;
                }
            }
        }
        return false;
    }

    function isInCheck(state, playerColor) {
        const kingPos = playerColor === 'w' ? state.whiteKingPos : state.blackKingPos;
        const opponent = getOpponentColor(playerColor);
        return isSquareAttacked(state, kingPos.row, kingPos.col, opponent);
    }

    function normalizeMove(move) {
        return {
            fromRow: move.fromRow,
            fromCol: move.fromCol,
            toRow: move.toRow != null ? move.toRow : move.row,
            toCol: move.toCol != null ? move.toCol : move.col,
            isEnPassant: !!move.isEnPassant,
            isCastling: !!move.isCastling,
            castleSide: move.castleSide || null,
            promotionChoice: move.promotionChoice || null
        };
    }

    function updateCastlingRightsAfterMove(state, movingPiece, fromRow, fromCol, capturedPiece, toRow, toCol) {
        const rights = state.castlingRights;
        const moverColor = movingPiece[0];
        const moverType = movingPiece[1];

        if (moverType === 'K') {
            if (moverColor === 'w') {
                rights.wK = false;
                rights.wQ = false;
            } else {
                rights.bK = false;
                rights.bQ = false;
            }
        }

        if (moverType === 'R') {
            if (moverColor === 'w' && fromRow === 7) {
                if (fromCol === 0) rights.wQ = false;
                if (fromCol === 7) rights.wK = false;
            }
            if (moverColor === 'b' && fromRow === 0) {
                if (fromCol === 0) rights.bQ = false;
                if (fromCol === 7) rights.bK = false;
            }
        }

        if (capturedPiece && capturedPiece[1] === 'R') {
            if (capturedPiece[0] === 'w' && toRow === 7) {
                if (toCol === 0) rights.wQ = false;
                if (toCol === 7) rights.wK = false;
            }
            if (capturedPiece[0] === 'b' && toRow === 0) {
                if (toCol === 0) rights.bQ = false;
                if (toCol === 7) rights.bK = false;
            }
        }
    }

    function applyMove(state, rawMove, options) {
        const opts = options || {};
        const move = normalizeMove(rawMove || {});
        if (move.fromRow == null || move.fromCol == null || move.toRow == null || move.toCol == null) {
            return null;
        }

        const board = state.board;
        const movingPiece = board[move.fromRow][move.fromCol];
        if (!movingPiece) return null;

        const moverColor = movingPiece[0];
        const moverType = movingPiece[1];
        const moveNumber = state.fullmoveNumber;

        let capturedPiece = board[move.toRow][move.toCol];
        let isEnPassant = move.isEnPassant;
        if (
            moverType === 'P' &&
            move.fromCol !== move.toCol &&
            !capturedPiece &&
            state.enPassantTarget &&
            state.enPassantTarget.row === move.toRow &&
            state.enPassantTarget.col === move.toCol
        ) {
            isEnPassant = true;
        }

        if (isEnPassant) {
            const capturedPawnRow = move.fromRow;
            capturedPiece = board[capturedPawnRow][move.toCol];
            board[capturedPawnRow][move.toCol] = null;
        }

        board[move.toRow][move.toCol] = movingPiece;
        board[move.fromRow][move.fromCol] = null;

        let isCastling = move.isCastling;
        let castleSide = move.castleSide;
        if (moverType === 'K' && Math.abs(move.toCol - move.fromCol) === 2) {
            isCastling = true;
            castleSide = move.toCol === 6 ? 'king' : 'queen';
        }

        if (isCastling) {
            const rookFromCol = castleSide === 'queen' ? 0 : 7;
            const rookToCol = castleSide === 'queen' ? 3 : 5;
            board[move.toRow][rookToCol] = board[move.toRow][rookFromCol];
            board[move.toRow][rookFromCol] = null;
        }

        let promotion = null;
        if (moverType === 'P' && (move.toRow === 0 || move.toRow === 7)) {
            promotion = move.promotionChoice || opts.promotionChoice || 'Q';
            board[move.toRow][move.toCol] = moverColor + promotion;
        }

        if (movingPiece === 'wK') state.whiteKingPos = { row: move.toRow, col: move.toCol };
        if (movingPiece === 'bK') state.blackKingPos = { row: move.toRow, col: move.toCol };

        updateCastlingRightsAfterMove(
            state,
            movingPiece,
            move.fromRow,
            move.fromCol,
            capturedPiece,
            move.toRow,
            move.toCol
        );

        if (moverType === 'P' && Math.abs(move.toRow - move.fromRow) === 2) {
            state.enPassantTarget = {
                row: (move.fromRow + move.toRow) / 2,
                col: move.fromCol
            };
        } else {
            state.enPassantTarget = null;
        }

        if (moverType === 'P' || capturedPiece) state.halfmoveClock = 0;
        else state.halfmoveClock += 1;

        const shouldSwitchPlayer = opts.switchPlayer !== false;
        if (shouldSwitchPlayer) {
            if (moverColor === 'b') state.fullmoveNumber += 1;
            state.currentPlayer = getOpponentColor(moverColor);
        }

        if (opts.recordPosition) {
            recordCurrentPosition(state);
        }

        return {
            fromRow: move.fromRow,
            fromCol: move.fromCol,
            toRow: move.toRow,
            toCol: move.toCol,
            piece: movingPiece,
            captured: capturedPiece || null,
            isEnPassant: !!isEnPassant,
            isCastling: !!isCastling,
            castleSide: castleSide || null,
            promotion: promotion,
            moveNumber: moveNumber,
            turn: moverColor
        };
    }

    function calculateLegalMoves(state, row, col) {
        const piece = state.board[row][col];
        if (!piece) return [];
        const color = piece[0];

        const pseudoMoves = getPotentialMovesForPiece(state, row, col, false);
        const legalMoves = [];

        for (const pseudo of pseudoMoves) {
            const move = {
                fromRow: row,
                fromCol: col,
                toRow: pseudo.row,
                toCol: pseudo.col,
                isEnPassant: !!pseudo.isEnPassant,
                isCastling: !!pseudo.isCastling,
                castleSide: pseudo.castleSide || null,
                promotionChoice: null
            };

            if (piece[1] === 'P' && (pseudo.row === 0 || pseudo.row === 7)) {
                move.promotionChoice = 'Q';
            }

            const snapshot = createStateSnapshot(state);
            applyMove(state, move, { switchPlayer: false, recordPosition: false });
            const kingInCheck = isInCheck(state, color);
            restoreStateSnapshot(state, snapshot);

            if (kingInCheck) continue;

            const legalMove = {
                row: pseudo.row,
                col: pseudo.col,
                captured: pseudo.captured || null,
                isEnPassant: !!pseudo.isEnPassant,
                isCastling: !!pseudo.isCastling,
                castleSide: pseudo.castleSide || null
            };
            if (piece[1] === 'P' && (pseudo.row === 0 || pseudo.row === 7)) {
                legalMove.promotionChoices = ['Q', 'R', 'B', 'N'];
                legalMove.promotionChoice = 'Q';
            }
            legalMoves.push(legalMove);
        }

        return legalMoves;
    }

    function getAllLegalMovesWithContext(state, playerColor) {
        const allMoves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = state.board[r][c];
                if (!piece || piece[0] !== playerColor) continue;
                const legalMoves = calculateLegalMoves(state, r, c);
                for (const move of legalMoves) {
                    allMoves.push({
                        fromRow: r,
                        fromCol: c,
                        toRow: move.row,
                        toCol: move.col,
                        piece: piece,
                        captured: move.captured || null,
                        isEnPassant: !!move.isEnPassant,
                        isCastling: !!move.isCastling,
                        castleSide: move.castleSide || null,
                        promotionChoice: move.promotionChoice || null
                    });
                }
            }
        }
        return allMoves;
    }

    function getDisambiguationText(stateBefore, moveRecord) {
        const piece = moveRecord.piece;
        if (!piece) return '';
        const pieceType = piece[1];
        if (pieceType === 'P' || pieceType === 'K') return '';

        const color = piece[0];
        const toRow = moveRecord.toRow;
        const toCol = moveRecord.toCol;

        const competitors = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (r === moveRecord.fromRow && c === moveRecord.fromCol) continue;
                const other = stateBefore.board[r][c];
                if (!other || other[0] !== color || other[1] !== pieceType) continue;

                const legal = calculateLegalMoves(stateBefore, r, c);
                if (legal.some(m => m.row === toRow && m.col === toCol)) {
                    competitors.push({ row: r, col: c });
                }
            }
        }

        if (!competitors.length) return '';

        const sameFile = competitors.some(p => p.col === moveRecord.fromCol);
        const sameRank = competitors.some(p => p.row === moveRecord.fromRow);

        if (!sameFile) return FILES[moveRecord.fromCol];
        if (!sameRank) return RANKS[moveRecord.fromRow];
        return FILES[moveRecord.fromCol] + RANKS[moveRecord.fromRow];
    }

    function moveToSAN(stateBefore, moveRecord, stateAfter) {
        if (!moveRecord || !moveRecord.piece) return 'InvalidMove';

        let san = '';
        if (moveRecord.isCastling) {
            san = moveRecord.castleSide === 'queen' ? 'O-O-O' : 'O-O';
        } else {
            const pieceType = moveRecord.piece[1];
            const isCapture = !!moveRecord.captured || !!moveRecord.isEnPassant;

            if (pieceType === 'P') {
                if (isCapture) san += FILES[moveRecord.fromCol] + 'x';
                san += getAlgebraicSquare(moveRecord.toRow, moveRecord.toCol);
                if (moveRecord.promotion) san += '=' + moveRecord.promotion;
            } else {
                san += pieceType;
                san += getDisambiguationText(stateBefore, moveRecord);
                if (isCapture) san += 'x';
                san += getAlgebraicSquare(moveRecord.toRow, moveRecord.toCol);
            }
        }

        const status = getGameStatus(stateAfter);
        if (status.reason === 'checkmate') san += '#';
        else if (status.isCheck) san += '+';

        return san;
    }

    function isInsufficientMaterial(state) {
        const pieces = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = state.board[r][c];
                if (!piece || piece[1] === 'K') continue;
                pieces.push({ piece, row: r, col: c });
            }
        }

        if (pieces.length === 0) return true;
        if (pieces.length === 1) {
            const type = pieces[0].piece[1];
            return type === 'B' || type === 'N';
        }
        if (pieces.length === 2) {
            const first = pieces[0];
            const second = pieces[1];
            if (first.piece[1] === 'B' && second.piece[1] === 'B') {
                const firstSquareColor = (first.row + first.col) % 2;
                const secondSquareColor = (second.row + second.col) % 2;
                return firstSquareColor === secondSquareColor;
            }
        }
        return false;
    }

    function getGameStatus(state) {
        const legalMoves = getAllLegalMovesWithContext(state, state.currentPlayer);
        const inCheck = isInCheck(state, state.currentPlayer);

        if (legalMoves.length === 0) {
            if (inCheck) {
                return {
                    isGameOver: true,
                    reason: 'checkmate',
                    winner: getOpponentColor(state.currentPlayer),
                    isCheck: true
                };
            }
            return {
                isGameOver: true,
                reason: 'stalemate',
                winner: null,
                isCheck: false
            };
        }

        const key = getPositionKey(state, state.currentPlayer);
        if ((state.positionRepetitionCounts[key] || 0) >= 3) {
            return {
                isGameOver: true,
                reason: 'threefold',
                winner: null,
                isCheck: inCheck
            };
        }

        if (state.halfmoveClock >= 100) {
            return {
                isGameOver: true,
                reason: 'fifty-move',
                winner: null,
                isCheck: inCheck
            };
        }

        if (isInsufficientMaterial(state)) {
            return {
                isGameOver: true,
                reason: 'insufficient-material',
                winner: null,
                isCheck: inCheck
            };
        }

        return {
            isGameOver: false,
            reason: null,
            winner: null,
            isCheck: inCheck
        };
    }

    global.ChessLogic = {
        createInitialState,
        createStateSnapshot,
        restoreStateSnapshot,
        getPositionKey,
        recordCurrentPosition,
        isInCheck,
        calculateLegalMoves,
        getAllLegalMovesWithContext,
        applyMove,
        moveToSAN,
        getAlgebraicSquare,
        getGameStatus
    };
})(typeof window !== 'undefined' ? window : self);

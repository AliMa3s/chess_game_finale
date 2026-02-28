global.window = global;
require('../chess-logic.js');

const ChessLogic = global.ChessLogic;

let failed = false;

function expect(condition, label) {
    if (!condition) {
        failed = true;
        console.error(`FAIL: ${label}`);
        return;
    }
    console.log(`PASS: ${label}`);
}

function expectEqual(actual, expected, label) {
    expect(actual === expected, `${label} (expected ${expected}, got ${actual})`);
}

function emptyState() {
    const state = ChessLogic.createInitialState();
    state.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    state.castlingRights = { wK: false, wQ: false, bK: false, bQ: false };
    state.enPassantTarget = null;
    state.halfmoveClock = 0;
    state.fullmoveNumber = 1;
    state.positionRepetitionCounts = {};
    return state;
}

function apply(state, fromRow, fromCol, toRow, toCol, moveExtras = {}, moveOptions = {}) {
    const move = { fromRow, fromCol, toRow, toCol, ...moveExtras };
    return ChessLogic.applyMove(state, move, {
        switchPlayer: true,
        recordPosition: false,
        ...moveOptions
    });
}

function perft(state, depth) {
    if (depth === 0) return 1;
    const moves = ChessLogic.getAllLegalMovesWithContext(state, state.currentPlayer);
    if (depth === 1) return moves.length;

    let total = 0;
    for (const move of moves) {
        const snapshot = ChessLogic.createStateSnapshot(state);
        ChessLogic.applyMove(state, move, { switchPlayer: true, recordPosition: false });
        total += perft(state, depth - 1);
        ChessLogic.restoreStateSnapshot(state, snapshot);
    }
    return total;
}

function testCastling() {
    const state = emptyState();
    state.board[7][4] = 'wK';
    state.whiteKingPos = { row: 7, col: 4 };
    state.board[0][4] = 'bK';
    state.blackKingPos = { row: 0, col: 4 };
    state.board[7][0] = 'wR';
    state.board[7][7] = 'wR';
    state.castlingRights = { wK: true, wQ: true, bK: false, bQ: false };

    const legal = ChessLogic.calculateLegalMoves(state, 7, 4);
    expect(legal.some(move => move.row === 7 && move.col === 6 && move.isCastling), 'white king-side castling available');
    expect(legal.some(move => move.row === 7 && move.col === 2 && move.isCastling), 'white queen-side castling available');
}

function testEnPassant() {
    const state = emptyState();
    state.board[7][4] = 'wK';
    state.whiteKingPos = { row: 7, col: 4 };
    state.board[0][4] = 'bK';
    state.blackKingPos = { row: 0, col: 4 };
    state.board[3][4] = 'wP'; // e5
    state.board[1][3] = 'bP'; // d7
    state.currentPlayer = 'b';

    apply(state, 1, 3, 3, 3);

    const legal = ChessLogic.calculateLegalMoves(state, 3, 4);
    const enPassant = legal.find(move => move.row === 2 && move.col === 3 && move.isEnPassant);
    expect(!!enPassant, 'en passant move generated');

    const applied = apply(state, 3, 4, 2, 3, { isEnPassant: true });
    expect(applied && applied.captured === 'bP', 'en passant captures pawn');
    expect(state.board[3][3] === null, 'captured pawn removed after en passant');
}

function testKingCaptureBlocked() {
    const state = emptyState();
    state.board[7][4] = 'wK';
    state.whiteKingPos = { row: 7, col: 4 };
    state.board[6][4] = 'bK';
    state.blackKingPos = { row: 6, col: 4 };

    const legal = ChessLogic.calculateLegalMoves(state, 7, 4);
    expect(!legal.some(move => move.row === 6 && move.col === 4), 'king cannot capture opposing king');
}

function testPromotionChoices() {
    const state = emptyState();
    state.board[7][4] = 'wK';
    state.whiteKingPos = { row: 7, col: 4 };
    state.board[0][4] = 'bK';
    state.blackKingPos = { row: 0, col: 4 };
    state.board[1][0] = 'wP'; // a7
    state.currentPlayer = 'w';

    const legal = ChessLogic.calculateLegalMoves(state, 1, 0);
    const promoteMove = legal.find(move => move.row === 0 && move.col === 0);
    expect(!!promoteMove, 'promotion move generated');
    expect(Array.isArray(promoteMove.promotionChoices), 'promotion choices available');
    expectEqual((promoteMove.promotionChoices || []).length, 4, 'promotion has four choices');

    apply(state, 1, 0, 0, 0, { promotionChoice: 'N' });
    expectEqual(state.board[0][0], 'wN', 'promotion choice applied');
}

function testSANDisambiguation() {
    const state = emptyState();
    state.board[7][0] = 'wK';
    state.whiteKingPos = { row: 7, col: 0 };
    state.board[0][7] = 'bK';
    state.blackKingPos = { row: 0, col: 7 };
    state.board[7][4] = 'wN';
    state.board[7][6] = 'wN';

    const before = ChessLogic.createStateSnapshot(state);
    const applied = apply(state, 7, 6, 5, 5);
    const san = ChessLogic.moveToSAN(before, applied, state);
    expect(san.startsWith('Ngf3'), 'SAN disambiguates identical piece moves');
}

function testDrawRules() {
    const repetitionState = emptyState();
    repetitionState.board[7][0] = 'wK';
    repetitionState.whiteKingPos = { row: 7, col: 0 };
    repetitionState.board[0][7] = 'bK';
    repetitionState.blackKingPos = { row: 0, col: 7 };
    repetitionState.currentPlayer = 'w';
    ChessLogic.recordCurrentPosition(repetitionState);

    const cycleMoves = [
        { fromRow: 7, fromCol: 0, toRow: 6, toCol: 0 },
        { fromRow: 0, fromCol: 7, toRow: 1, toCol: 7 },
        { fromRow: 6, fromCol: 0, toRow: 7, toCol: 0 },
        { fromRow: 1, fromCol: 7, toRow: 0, toCol: 7 },
        { fromRow: 7, fromCol: 0, toRow: 6, toCol: 0 },
        { fromRow: 0, fromCol: 7, toRow: 1, toCol: 7 },
        { fromRow: 6, fromCol: 0, toRow: 7, toCol: 0 },
        { fromRow: 1, fromCol: 7, toRow: 0, toCol: 7 }
    ];
    for (const move of cycleMoves) {
        ChessLogic.applyMove(repetitionState, move, { switchPlayer: true, recordPosition: true });
    }

    const repetitionStatus = ChessLogic.getGameStatus(repetitionState);
    expectEqual(repetitionStatus.reason, 'threefold', 'threefold repetition draw detected');

    const fiftyState = emptyState();
    fiftyState.board[7][0] = 'wK';
    fiftyState.whiteKingPos = { row: 7, col: 0 };
    fiftyState.board[0][7] = 'bK';
    fiftyState.blackKingPos = { row: 0, col: 7 };
    fiftyState.halfmoveClock = 100;
    const fiftyStatus = ChessLogic.getGameStatus(fiftyState);
    expectEqual(fiftyStatus.reason, 'fifty-move', '50-move rule draw detected');

    const insufficientState = emptyState();
    insufficientState.board[7][0] = 'wK';
    insufficientState.whiteKingPos = { row: 7, col: 0 };
    insufficientState.board[0][7] = 'bK';
    insufficientState.blackKingPos = { row: 0, col: 7 };
    const insufficientStatus = ChessLogic.getGameStatus(insufficientState);
    expectEqual(insufficientStatus.reason, 'insufficient-material', 'insufficient material draw detected');
}

function testCheckmateDetection() {
    const state = ChessLogic.createInitialState();
    ChessLogic.recordCurrentPosition(state);

    apply(state, 6, 5, 5, 5, {}, { recordPosition: true }); // 1. f3
    apply(state, 1, 4, 3, 4, {}, { recordPosition: true }); // ... e5
    apply(state, 6, 6, 4, 6, {}, { recordPosition: true }); // 2. g4
    apply(state, 0, 3, 4, 7, {}, { recordPosition: true }); // ... Qh4#

    const status = ChessLogic.getGameStatus(state);
    expect(status.isGameOver, 'checkmate ends game');
    expectEqual(status.reason, 'checkmate', 'fools mate checkmate reason');
    expectEqual(status.winner, 'b', 'fools mate winner');
}

function testPerftStartPosition() {
    const state = ChessLogic.createInitialState();
    const d1 = perft(state, 1);
    const d2 = perft(state, 2);
    const d3 = perft(state, 3);

    expectEqual(d1, 20, 'perft depth 1 from start');
    expectEqual(d2, 400, 'perft depth 2 from start');
    expectEqual(d3, 8902, 'perft depth 3 from start');
}

testCastling();
testEnPassant();
testKingCaptureBlocked();
testPromotionChoices();
testSANDisambiguation();
testDrawRules();
testCheckmateDetection();
testPerftStartPosition();

if (failed) process.exit(1);

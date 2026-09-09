const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cors());

// In-memory lobby for active games
const gameLobby = {};

// Platform Fee: 5% of the total pot
const PLATFORM_FEE_PERCENTAGE = 0.05;

// Helper: Generates a cryptographically secure random string
const generateSeed = () => crypto.randomBytes(32).toString('hex');

/**
 * 1. PLAYER 1 CREATES GAME
 */
app.post('/api/create-pvp-game', (req, res) => {
    const { player1Id, player1Seed, wagerAmount } = req.body;

    const serverSeed = generateSeed();
    const serverHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const gameId = crypto.randomUUID();

    gameLobby[gameId] = {
        status: 'waiting',
        player1Id,
        player1Seed,
        wagerAmount,
        serverSeed,
        serverHash
    };

    res.json({ 
        message: 'Game created, waiting for Player 2.',
        gameId, 
        wagerAmount,
        serverHash 
    });
});

/**
 * 2. PLAYER 2 JOINS & RESOLVES GAME
 */
app.post('/api/join-pvp-game', (req, res) => {
    const { gameId, player2Id, player2Seed } = req.body;
    const game = gameLobby[gameId];

    if (!game || game.status !== 'waiting') {
        return res.status(400).json({ error: 'Game not found or already in progress.' });
    }

    game.status = 'completed';
    game.player2Id = player2Id;
    game.player2Seed = player2Seed;

    const totalPot = game.wagerAmount * 2;
    const platformRake = totalPot * PLATFORM_FEE_PERCENTAGE; // The 5% House Cut
    const winnerPayout = totalPot - platformRake;

    // Provably Fair Math
    const combinedString = `${game.serverSeed}-${game.player1Seed}-${game.player2Seed}`;
    const resultHash = crypto.createHash('sha256').update(combinedString).digest('hex');

    const rollResult = parseInt(resultHash.substring(0, 5), 16) % 2;
    const winnerId = rollResult === 0 ? game.player1Id : game.player2Id;

    game.winnerId = winnerId;
    game.platformProfit = platformRake;

    res.json({
        winnerId,
        totalPot,
        winnerPayout,
        platformFeeCollected: platformRake,
        serverSeed: game.serverSeed
    });
});

/**
 * 3. VIEW ACTIVE LOBBY
 */
app.get('/api/lobby', (req, res) => {
    const waitingGames = Object.entries(gameLobby)
        .filter(([id, game]) => game.status === 'waiting')
        .map(([id, game]) => ({
            gameId: id,
            player1Id: game.player1Id,
            wagerAmount: game.wagerAmount
        }));
    
    res.json(waitingGames);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`PvP Web3 Backend running on port ${PORT}`);
});

const game = {
    id: 73,
    name: "SpaceFlight",
};

const gameConfig = {
    time: "2021-01-27T05:44:23.069+00:00",
    type: 0,
    name: "spaceflight",
    enabled: true,
    botenabled: true,
    minbet: 1,
    maxbet: 2000,
    disabledround: 0,
    bot_maxbet: 2000,
    hour_maxbot: [0, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0, 0, 0, 0, 0, 0, 0],
    disabled_message: "Game đang được bảo trì, vui lòng quay lại sau 10 phút.",
    choices_maxbet: {},
    odds: {},
    delayStartTime: 0,
    enableFreeBet: false,
    siteExclusions: null,
    smartBotEnabled: false,
    smartBotGroupRatio: 0,
    exchangeReload: false,
    reloadExchange: true,
    randomMode: 2,
    displayName: "Space Flight",
    gameId: 73,
    maxMultiplier: 2000,
    crashConfig: {
        maxWinPerRound: 1000,
    },
};

const currencyData = { code: "USD", name: "$US" };

const userBetData = ({ uid, name, playerId }) => {
    return [
      
    ];
};

const rounds = [];

const socketOptions = {
    socketUri: "http://localhost:5001/user/spaceflight",
    gameName: game.name,
    proxyRoute: "/socket.io",
};

export { currencyData, game, gameConfig, rounds, socketOptions, userBetData };


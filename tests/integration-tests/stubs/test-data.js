const game = {
    id: 73,
    name: "Spaceflight",
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
    crashConfig: {
        maxWinPerRound: 1000,
        maxMultiplier: 2000,
    },
};

const currencyData = { code: "USD", name: "$US" };

const userBetData = ({ uid, name, playerId }) => {
    return [
        {
            time: new Date(),
            amount: 100,
            betwin: 0,
            freeBet: false,
            roundId: 1,
            paid: false,
            uid,
            name,
            playerId,
            rate: 1,
            exchangeRateId: 1,
            siteId: "4100300",
            currency: "$US",
            operatorId: "ONEworks1",
        },
    ];
};

const rounds = [];

const hashResults = [
    {
        time: new Date(),
        roundId: 1,
        encryptedResultHash: {
            iv: "28c975ff0d360a3f99a8173c78438519",
            content:
                "52f2b233602b55bfe7629f62a80d1ccf49613161da5bad4469ab5ab6b5283f0c04a43973c0a9b8034cbe1f581fa11ab1328eda01be8915cc20ad1ef9d923ff7cf0012c99c562352a3de48113671ef07b12887c76a2e296e0e66e892e2f2a7408a057f46408f20e914e69",
        },
        encryptedResult: {
            iv: "054eb748a3fd3fcc6a8fc9061e612459",
            content: "2d7fe7c7",
        },
    },
];

const socketOptions = {
    socketUri: "http://localhost:5001/user/spaceflight",
    gameName: game.name,
    proxyRoute: "/socket.io",
};

export { currencyData, game, gameConfig, hashResults, rounds, socketOptions, userBetData };


export default {
    hostingPort: 5000,
    apiSettings: {
        enabledApi: true,
        apiUrl: "http://l2_game_api_sit:5000",
        authUrl: "http://l2_auth_api_sit:5000",
        client: {
            id: "game-server",
            secret: "gameserver@20luminet&",
        },
        useAuthenticate: true,
        requestTimeout: 10000,
        placeBetTimeout: 4000,
        enabledApiLogs: true,
    },
    authenticateSettings: {
        url: "http://l2_auth_api_sit:5000",
        id: "game-services",
        secret: "gameservices@20luminet&",
        requestTimeout: 10000,
        useAuthenticate: true,
        audiences: ["api", "admin-api"],
    },
    userServiceSettings: {
        url: "http://l2_user_service_sit:5000",
    },
    socketOptions: {
        pingInterval: 60 * 1000,
        pingTimeout: 60 * 1000,
        transports: ["websocket"],
        allowUpgrades: false,
        perMessageDeflate: false,
    },
    enabledLogs: true,
    database: {
        url: "mongodb://lmn_backend:LmnBackend%40517@10.99.99.187:37301/?replicaSet=SabaL2SIT&appName=crashgame",
        options: {
            dbName: "minigame",
            useNewUrlParser: true,
            useUnifiedTopology: true,
        },
    },
    sentry: {
        sentryUrl: "http://8ac47fca6d3e4a41908896a64ef201ac@10.2.190.51:9009/53",
        logIdentifier: "crashgame",
        env: "SIT",
    },
    adminSecretKey: "asWDEerfOIdgsdqRTFabvmgh",
    enableCorsWs: true,
    corsUrls: [
        "http://l2sit.sgamesuat.com",
        "https://l2sit.sgamesuat.com",
        "http://l2sitadm.sgamesuat.com",
        "https://l2sitadm.sgamesuat.com",
        "http://l2sitm.sgamesuat.com",
        "https://l2sitm.sgamesuat.com",
    ],
    metrics: {
        enable: true,
        secretKey: "6c1f0f28-70f2-46ae-b031-22624a6cd8df",
    },
    enableMsgpackParser: true,
};

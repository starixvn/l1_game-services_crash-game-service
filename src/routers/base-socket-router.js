import { Routers } from "sc-game-base/src/core";

export default class BaseSocketRouter extends Routers.BaseSocketRouter {
    constructor({
        definition,
        gameData,
        userSignInConsumer,
        inGameConsumer,
        placeBetConsumer,
        userDisconnectConsumer,
        userSignInPublisher,
        historyQuery,
        logService,
        playGamePermissionValidator,
        cashOutConsumer,
    }) {
        super({
            definition,
            gameData,
            userSignInConsumer,
            inGameConsumer,
            placeBetConsumer,
            userDisconnectConsumer,
            userSignInPublisher,
            historyQuery,
            logService,
            playGamePermissionValidator,
        });

        this.cashOutConsumer = cashOutConsumer;
    }

    init(socketClient) {
        super.init(socketClient);

        this.socketClient.on("cashOut", this.handleCashOut.bind(this));
    }

    handleCashOut(payload) {
        try {
            if (!this.verify()) {
                return;
            }

            this.cashOutConsumer.consume(this.gameData.realPlayers[this.socketClient.id], payload);
        } catch (error) {
            this.logService.logError(error);
        }
    }
}

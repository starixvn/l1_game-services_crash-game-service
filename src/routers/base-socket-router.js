import { logger } from "sc-common";
import { Socket } from "socket.io";

import { PlayGamePermissionValidator } from "../validators";
import { InGameConsumer, PlaceBetConsumer, UserDisconnectConsumer, UserSignInConsumer } from "./../event-consumers";
import { UserSignInPublisher } from "./../event-publishers";
import { HistoryQuery } from "./../query-apis";

export default class BaseSocketRouter {
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

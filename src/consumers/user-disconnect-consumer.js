import { Core } from "sc-game-base";
import { Actions } from "../constants";
import { SettleCashOutConsumer } from "./settle-cash-out-consumer";

export class UserDisconnectConsumer extends Core.BaseEventConsumers.UserDisconnectConsumer {
    /**
     * @param {Object} dependencies
     * @param {GameData} dependencies.gameData
     * @param {BaseEventPublisher} dependencies.baseEventPublisher
     * @param {logger} dependencies.logService
     * @param {mongoose.Model} dependencies.betLogsRepository
     * @param {SettleCashOutConsumer} dependencies.settleCashOutConsumer
     */
    constructor(gameData, betLogsRepository, settleCashOutConsumer) {
        super(gameData);
        this.settleCashOutConsumer = settleCashOutConsumer;
        this.betLogsRepository = betLogsRepository;
    }

    async consume(socketClient) {
        const player = this.gameData.realPlayers[socketClient.id];
        if (!player) {
            return;
        }

        const isValidCashOut = this.settleCashOutConsumer.validateCashOut(player);

        if (isValidCashOut) {
            await this.settleCashOutConsumer.proceedCashOut(player, { action: Actions.CashOut });
        }

        delete this.gameData.provablyFair[player.profile.name];
        delete this.gameData.ingame[player.profile.name];

        super.consume(socketClient);
    }
}

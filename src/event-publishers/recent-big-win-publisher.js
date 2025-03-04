import { Core } from "sc-game-base";
import { BigWinConsumer } from "../consumers";
import { Systems } from "sc-game-base/src/constants";
import { logger } from "sc-common";
import * as util from "util";
export default class RecentBigWinPublisher extends Core.BaseEventPublishers.BaseEventPublisher {
    /**
     * @param {string} gameName
     * @param {GameData} gameData
     * @param {BigWinConsumer} bigWinConsumer
     */

    constructor(gameName, gameData, bigWinConsumer) {
        super(gameName, gameData);

        this.bigWinConsumer = bigWinConsumer;
    }

    publish(recentBigWinningWinner) {
        const players = Object.values(this.gameData.realPlayers).filter((player) => player.session?.system !== Systems.Mobi);

        logger.log(util.inspect(players));
        players.forEach((player) => {
            const socket = player.socketClient;
            this.bigWinConsumer.updateExchangeRateCode(player, [recentBigWinningWinner]);
            socket.emit(this.gameName, { recentBigWinningWinner });
        });
    }
}

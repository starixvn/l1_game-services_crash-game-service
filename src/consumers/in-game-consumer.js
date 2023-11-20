import { EventConsumers } from "sc-game-base/src/table";

export class InGameConsumer extends EventConsumers.TableInGameConsumer {
    async buildPayload(realPlayer) {
        const basePayload = await super.buildPayload(realPlayer);
        basePayload.gameConfigs.maxMultiplier = this.gameData.gameConfigs.crashConfig.maxMultiplier;
        basePayload.gameConfigs.maxWinPerRound = this.gameData.gameConfigs.crashConfig.maxWinPerRound;

        const { runningBets } = this.gameData;
        return {
            ...basePayload,
            otherPlayers: runningBets,
            betList: this.gameData.betList,
        };
    }
}

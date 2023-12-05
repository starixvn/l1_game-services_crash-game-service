import { EventConsumers } from "sc-game-base/src/table";

export class InGameConsumer extends EventConsumers.TableInGameConsumer {
    async buildPayload(realPlayer) {
        const basePayload = await super.buildPayload(realPlayer);
        basePayload.gameConfigs.maxMultiplier = this.gameData.gameConfigs.crashConfig.maxMultiplier;
        basePayload.gameConfigs.maxWinPerRound = this.gameData.gameConfigs.crashConfig.maxWinPerRound;

        return {
            ...basePayload,
            otherPlayers: { ...this.gameData.betList, [realPlayer.UID]: undefined },
            ownBets: this.gameData.betList[realPlayer.UID],
        };
    }
}

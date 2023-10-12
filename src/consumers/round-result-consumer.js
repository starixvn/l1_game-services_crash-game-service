import { Core } from "sc-game-base";

export default class RoundResultConsumer extends Core.BaseEventConsumers.RoundResultConsumer {
    generateResult() {
        const resultFromAdmin = this.gameData.settlementResultFromAdmin;
        const { randomMode, crashConfig } = this.gameData.gameConfigs;
        const { maxMultiplier, crashAtBase } = crashConfig;

        const result =
            this.gameData.roundId === resultFromAdmin.roundId
                ? resultFromAdmin.result
                : this.definition.generateResult(randomMode, crashAtBase);

        return result < maxMultiplier ? result : maxMultiplier;
    }
}

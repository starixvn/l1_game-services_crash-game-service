import { BaseEventConsumers } from "sc-game-base/src/core";

export class InGameConsumer extends BaseEventConsumers.InGameConsumer {
    async buildPayload(realPlayer) {
        const basePayload = await super.buildPayload(realPlayer);
        const { runningBets } = this.gameData;
        return {
            ...basePayload,
            otherPlayers: runningBets,
        };
    }
}

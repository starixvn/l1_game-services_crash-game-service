import { EventConsumers } from "sc-game-base/src/table";

export class InGameConsumer extends EventConsumers.TableInGameConsumer {
    async buildPayload(realPlayer) {
        const basePayload = await super.buildPayload(realPlayer);
        const { runningBets } = this.gameData;
        return {
            ...basePayload,
            otherPlayers: runningBets,
        };
    }
}

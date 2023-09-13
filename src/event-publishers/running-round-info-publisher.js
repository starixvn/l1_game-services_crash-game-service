import { Core } from "sc-game-base";

export default class RunningRoundInfoPublisher extends Core.BaseEventPublishers.RunningRoundInfoPublisher {
    publish() {
        this.publishToAllUsers({ multiplier: this.gameData.multiplier, liveTime: this.gameData.liveTime });
    }
}

import { Core } from "sc-game-base";
import { calculateMultiplier } from "../helpers/crash-point-helper";

export default class LiveGamePublisher extends Core.BaseEventPublishers.BaseEventPublisher {
    publish() {
        const liveTime = new Date() - this.gameData.startTime;
        this.publishToAllUsers({ multiplier: calculateMultiplier(liveTime), liveTime });
    }
}

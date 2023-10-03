import { Core } from "sc-game-base";

export default class PlaceBetPublisher extends Core.BaseEventPublishers.PlaceBetPublisher {
    publishSuccessBet(playerId, payload, rate) {
        super.publishSuccessBet(playerId, payload);
        this.publishToAllUsersExcept(playerId, { otherPlayer: payload });
    }
}

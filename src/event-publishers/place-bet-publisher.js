import { Table } from "sc-game-base";

export default class PlaceBetPublisher extends Table.EventPublishers.TablePlaceBetPublisher {
    publishSuccessCashOut(playerId, payload, rate) {
        this.publishToUser(playerId, payload);
        this.publishToAllUsersExcept(playerId, { otherPlayer: { ...payload, rate } });
    }
}

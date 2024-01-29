import { Table } from "sc-game-base";
import { MaxCombinedClientSeeds } from "./constants";

export default class GameData extends Table.TableGameData {
    constructor(remainingTime) {
        super(remainingTime);
        this.betList = {};
        this.clientSeeds = [];
    }

    addPlayerToBetList(playerId, { name, amount, rate, autoCashOut }) {
        this.betList[playerId] = { time: new Date(), playerId, name, amount, rate, autoCashOut };
    }

    updatePlayerAction(playerId, action, data) {
        this.betList[playerId][action] = data;
        this.betList[playerId].time = new Date();
    }

    addClientSeed({ name, clientSeed }) {
        this.clientSeeds.length < MaxCombinedClientSeeds && this.clientSeeds.push({ name, clientSeed });
    }
}

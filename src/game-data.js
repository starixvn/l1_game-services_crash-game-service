import { Table } from "sc-game-base";

export default class CrashGameData extends Table.TableGameData {
    constructor(remainingTime) {
        super(remainingTime);
        this.betList = {};
    }

    addPlayerToBetList(playerId, { name, amount, rate }) {
        this.betList[playerId] = { playerId, name, amount, rate };
    }

    updatePlayerAction(playerId, action, data) {
        this.betList[playerId][action] = data;
    }
}

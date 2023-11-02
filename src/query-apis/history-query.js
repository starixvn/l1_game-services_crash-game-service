import { QueryApis } from "sc-game-base/src/core";

export default class HistoryQuery extends QueryApis.HistoryQuery {
    convertBet(bet) {
        return { ...bet, totalAmount: bet.amount };
    }
}

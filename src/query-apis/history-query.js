import { QueryApis } from "sc-game-base/src/core";

export default class HistoryQuery extends QueryApis.HistoryQuery {
    convertBet(bet) {
        return { ...bet, totalAmount: bet.amount };
    }

    getBetLogDetails(player, roundId) {
        return this.betLogsRepository
            .find(
                { roundId, uid: player.UID },
                { _id: false, time: true, multiplier: true, amount: true, winAmount: true, action: true, reachMaxWin: true },
                { sort: { _id: -1 } }
            )
            .lean()
            .exec();
    }
}

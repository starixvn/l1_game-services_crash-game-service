import { QueryApis } from "sc-game-base/src/core";

export default class HistoryQuery extends QueryApis.HistoryQuery {
    convertBet(bet) {
        return { ...bet, totalAmount: bet.amount };
    }

    async queryHistory(player, page, pageSize = 8) {
        if (page < 1 || !player) {
            return {};
        }

        const filter = { uid: player.UID, paid: true };
        const numberOfSkippedBets = (page - 1) * pageSize;
        const total = await this.betsRepository.countDocuments(filter).exec();
        const betProjection = {
            _id: false,
            uid: false,
            paid: false,
            odds: false,
            siteId: false,
            playerId: false,
            __v: false,
            __archive: false,
            currency: false,
            operatorId: false,
        };
        const bets = await this.betsRepository
            .find(filter, betProjection, { sort: { id: -1 }, skip: numberOfSkippedBets, limit: pageSize })
            .lean()
            .exec();

        return { history: { betLogs: bets, page, pageSize, total } };
    }
}

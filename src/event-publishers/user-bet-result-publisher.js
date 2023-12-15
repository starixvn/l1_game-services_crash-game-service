import { BaseEventPublishers } from "sc-game-base/src/core";

export default class UserBetResultPublisher extends BaseEventPublishers.UserBetResultPublisher {
    async publish(userId, betResult) {
        const status = this.getBetResultStatus(betResult);

        await this.publishToUser(userId, { status });
    }

    getBetResultStatus(betResult) {
        if (betResult.totalWin > 0) {
            return {
                win: true,
                bet: betResult.totalWin,
                reachMaxWin: betResult.reachMaxWin,
            };
        }

        return { win: false, bet: betResult.totalLost };
    }
}

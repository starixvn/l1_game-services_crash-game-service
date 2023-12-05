import { BaseEventPublishers } from "sc-game-base/src/core";

export default class UserBetResultPublisher extends BaseEventPublishers.UserBetResultPublisher {
    async publish(userId, betResult) {
        const status = { winningByChoices: betResult.winningByChoices };

        if (betResult.totalWin > 0) {
            status.win = true;
            status.bet = betResult.totalWin;
            status.reachMaxWin = betResult.reachMaxWin;
        } else {
            status.win = false;
            status.bet = betResult.totalLost;
        }

        await this.publishToUser(userId, { status });
    }
}

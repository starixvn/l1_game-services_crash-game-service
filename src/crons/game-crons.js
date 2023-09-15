import { Core } from "sc-game-base";

export default class GameCrons extends Core.Crons.BaseGameCron {
    async proceed() {
        const { durations } = this.definition;

        if (this.gameData.remainingTime === durations.wholeRound) {
            await this.checkGameStatus();
        }

        if (!this.gameData.disabled) {
            this.gameData.remainingTime--;
        }

        if (this.isStartingTime(this.gameData.remainingTime, durations)) {
            this.resetForNewRound();
            this.bot && (await this.bot.reset());
            this.appConfigs.enabledBoostedOdds && (await this.updatePromotionOddsAndNotify());
        }

        if (this.gameData.remainingTime === durations.placingBets && this.resultsRepository) {
            await this.roundResultConsumer.generateResultAndPublishHash(this.gameData.lastResultRecord);
            this.gameData.settlementResultFromAdmin = {};
        }

        if (this.gameData.remainingTime === durations.placingBets) {
            this.gameStatusPublisher.publishStartPlacingBetStatus();
        }

        if (this.gameData.remainingTime === durations.lockingBet - 1) {
            this.gameStatusPublisher.publishEndPlacingBetStatus();
            this.startDelaySettleRound();
        }

        if (this.gameData.remainingTime < durations.placingBets) {
            this.bot && (await this.bot.run());
            this.runningRoundInfoPublisher.publish();
        }
    }

    getSettleTimeInSecond(roundResult) {
        return 4 * Math.sqrt(roundResult - 1);
    }

    startDelaySettleRound() {
        const gameResult = this.gameData.result;
        const settleTimeOut = this.getSettleTimeInSecond(gameResult) * 1000;

        setTimeout(async () => {
            await this.settleGameRoundConsumer.settleRound(this.gameData);
            this.gameData.remainingTime = durations.wholeRound;
        }, settleTimeOut);

        this.gameData.startTime = new Date();
    }
}

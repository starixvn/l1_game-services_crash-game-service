import { BaseEventConsumers } from "sc-game-base/src/core";

export class SettleGameRoundConsumer extends BaseEventConsumers.SettleGameRoundConsumer {
    async settleBets({ result, roundId, time, startTime }) {
        const bets = await this.queryBets(roundId);

        if (bets && bets.length) {
            await Promise.all(
                bets.map(async (bet) => {
                    const betResult = this.calculateBetResult(bet, result, startTime);

                    bet.betwin = betResult.totalWin;
                    bet.paid = true;
                    bet.multiplier = betResult.totalWin / bet.amount;

                    await bet.save();
                    await this.callEndGame(bet, roundId, time, betResult);

                    this.captureBetResult(bet.uid, betResult);
                    await this.userBetResultPublisher.publish(bet.uid, betResult);
                })
            );
        }

        this.roundResultPublisher.publishRoundResult(this.collectRoundResult(result, settlementResult, roundId));
    }

    calculateBetResult(bet, result, startTime) {
        const { cashOutTime, amount } = bet;
        const winMultiplier = this.calculateMultiplier(cashOutTime, startTime);
        const winAmount = winMultiplier <= result ? winMultiplier * amount : 0;

        return {
            totalBetAmount: amount,
            totalWin: winAmount,
            netWin: winAmount > 0 ? winAmount - amount : 0,
            totalLost: winAmount > 0 ? 0 : amount,
        };
    }

    calculateMultiplier(cashOutTime, startTime) {
        const time = cashOutTime - startTime;

        return (time / 1000) ** 2 / 16 + 1;
    }
}

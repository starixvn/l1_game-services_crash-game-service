import { BaseEventConsumers } from "sc-game-base/src/core";
import { calculateMultiplier } from "../helpers/crash-point-helper";

export class SettleGameRoundConsumer extends BaseEventConsumers.SettleGameRoundConsumer {
    async settleBets({ result, settlementResult, roundId, time }) {
        const bets = await this.queryBets(roundId);

        if (bets && bets.length) {
            await Promise.all(
                bets.map(async (bet) => {
                    const betResult = this.calculateBetResult(bet, result, this.gameData.startTime);

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

    calculateCashOutPoint(cashOutTime, startTime) {
        const time = cashOutTime - startTime;

        return calculateMultiplier(time);
    }
}

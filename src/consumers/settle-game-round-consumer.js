import { BaseEventConsumers } from "sc-game-base/src/core";

export class SettleGameRoundConsumer extends BaseEventConsumers.SettleGameRoundConsumer {
    constructor({
        definition,
        gameData,
        roundResultPublisher,
        userBetResultPublisher,
        endGame,
        roundsRepository,
        betsRepository,
        betLogsRepository,
    }) {
        super({ definition, gameData, roundResultPublisher, userBetResultPublisher, endGame, roundsRepository, betsRepository });

        this.betLogsRepository = betLogsRepository;
    }

    async settleBets({ roundId, time }) {
        const bets = await this.queryBets(roundId);
        const betLogs = await this.betLogsRepository.find({ roundId }).lean().exec();

        if (bets && bets.length) {
            await Promise.all(
                bets.map(async (bet) => {
                    const betLog = betLogs?.filter((log) => log.playerId == bet.playerId);
                    const betResult = this.calculateBetResult(bet, betLog);

                    bet.betwin = betResult.totalWin;
                    bet.paid = true;

                    await bet.save();
                    await this.callEndGame(bet, roundId, time, betResult);
                    await this.userBetResultPublisher.publish(bet.uid, betResult);
                })
            );
        }
    }

    calculateWinAmount(betLog = []) {
        return betLog.reduce((win, log) => win + (log.winAmount ?? 0), 0) ?? 0;
    }

    calculateBetResult(bet, betLog = []) {
        const { amount } = bet;
        const winAmount = this.calculateWinAmount(betLog);
        const winLoss = winAmount - amount;

        return {
            totalBetAmount: amount,
            totalWin: winAmount,
            netWin: winLoss > 0 ? winLoss : 0,
            totalLost: winLoss < 0 ? -winLoss : 0,
        };
    }
}

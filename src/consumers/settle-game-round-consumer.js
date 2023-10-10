import { EventConsumers } from "sc-game-base/src/table";

export class SettleGameRoundConsumer extends EventConsumers.TableSettleGameRoundConsumer {
    constructor({
        definition,
        gameData,
        roundResultPublisher,
        userBetResultPublisher,
        endGame,
        roundsRepository,
        betsRepository,
        betLogsRepository,
        tempBetsRepository,
        tempBetLogsRepository,
    }) {
        super({
            definition,
            gameData,
            roundResultPublisher,
            userBetResultPublisher,
            endGame,
            roundsRepository,
            betsRepository,
            tempBetsRepository,
        });

        this.betLogsRepository = betLogsRepository;
        this.tempBetLogsRepository = tempBetLogsRepository;
    }

    async queryBetLogs(roundId) {
        const realPlayerBetLogs = await this.betLogsRepository.find({ roundId }).lean().exec();
        const botBetLogs = await this.tempBetLogsRepository.find({ roundId }).lean().exec();

        return realPlayerBetLogs.concat(botBetLogs);
    }

    async settleBets({ roundId, time }) {
        const bets = await this.queryBets(roundId);
        const betLogs = await this.queryBetLogs(roundId);

        if (bets && bets.length) {
            await Promise.all(
                bets.map(async (bet) => {
                    const betLog = betLogs?.filter((log) => log.uid === bet.uid);
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

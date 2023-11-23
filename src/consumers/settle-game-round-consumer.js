import { EventConsumers } from "sc-game-base/src/table";
import { Actions } from "../constants";

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
        await this.addRefundBetLogForPlayersOnUM(bets, betLogs);

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

    async addRefundBetLogForPlayersOnUM(bets, betLogs) {
        const playersOnUM = Object.values(this.gameData.ingame).filter((x) => x.isUm);
        if (playersOnUM.length > 0) {
            const refundBetLogs = [];
            for (const player of playersOnUM) {
                const { playerData } = player;
                const bet = bets.find((x) => x.playerId === playerData.session.playerId && x.operatorId === playerData.session.operatorId);
                const halfCashOutBetLog = betLogs.find(
                    (x) =>
                        x.action === Actions.HalfCashOut &&
                        x.playerId === playerData.session.playerId &&
                        x.operatorId === playerData.session.operatorId
                );

                const refundAmount = halfCashOutBetLog ? halfCashOutBetLog.amount : bet.amount;
                refundBetLogs.push({
                    uid: bet.uid,
                    name: bet.name,
                    time: new Date(),
                    action: Actions.Refund,
                    amount: refundAmount,
                    winAmount: refundAmount,
                    clientSentTime: new Date(),
                    receivedTime: new Date(),
                    roundId: bet.roundId,
                    siteId: bet.siteId,
                    currency: bet.currency,
                    rate: bet.rate,
                    operatorId: bet.operatorId,
                    playerId: bet.playerId,
                });
            }

            await this.betLogsRepository.insertMany(refundBetLogs);
            betLogs.push(...refundBetLogs);
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
            totalBetAmount: +amount.toFixed(2),
            totalWin: +winAmount.toFixed(2),
            netWin: +(winLoss > 0 ? winLoss : 0).toFixed(2),
            totalLost: +(winLoss < 0 ? -winLoss : 0).toFixed(2),
        };
    }
}

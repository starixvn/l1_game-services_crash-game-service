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

        const refundBetlogs = await this.addRefundBetLogForPlayersOnUM(bets, betLogs);
        betLogs.push(...refundBetlogs);

        const crashBetLogs = await this.addCrashBetLog(bets, betLogs, time);
        betLogs.push(...crashBetLogs);

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

            refundBetLogs.push(
                this.createBetLog(bet, {
                    time: new Date(),
                    amount: refundAmount,
                    winAmount: refundAmount,
                    action: Actions.Refund,
                })
            );
        }

        await this.betLogsRepository.insertMany(refundBetLogs);
        return refundBetLogs;
    }

    async addCrashBetLog(bets, betLogs, crashTime) {
        const crashBetLogs = [];
        for (const bet of bets) {
            if (
                !betLogs.some(
                    (x) =>
                        (x.action === Actions.CashOut || x.action === Actions.Refund) &&
                        x.playerId === bet.playerId &&
                        x.operatorId === bet.operatorId
                )
            ) {
                const halfCashOutBetLog = betLogs.find(
                    (x) => x.action === Actions.HalfCashOut && x.playerId === bet.playerId && x.operatorId === bet.operatorId
                );

                crashBetLogs.push(
                    this.createBetLog(bet, {
                        time: crashTime,
                        amount: halfCashOutBetLog ? halfCashOutBetLog.amount : bet.amount,
                        winAmount: 0,
                        action: Actions.Crash,
                    })
                );
            }
        }

        await this.betLogsRepository.insertMany(crashBetLogs);
        return crashBetLogs;
    }

    createBetLog(bet, { time, amount, winAmount, action }) {
        return {
            uid: bet.uid,
            name: bet.name,
            time,
            action,
            amount,
            winAmount,
            clientSentTime: new Date(),
            receivedTime: new Date(),
            roundId: bet.roundId,
            siteId: bet.siteId,
            currency: bet.currency,
            rate: bet.rate,
            operatorId: bet.operatorId,
            playerId: bet.playerId,
        };
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

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
        logService,
        provablyFairConsumer,
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
        this.logService = logService;
        this.provablyFairConsumer = provablyFairConsumer;
    }

    queryRound(roundId) {
        return this.roundsRepository.findOne({ id: roundId }).exec();
    }

    async queryBetLogs(roundId) {
        const [realPlayerBetLogs, botBetLogs] = await Promise.all([
            this.betLogsRepository.find({ roundId }).lean().exec(),
            this.tempBetLogsRepository.find({ roundId }).lean().exec(),
        ]);

        return [...realPlayerBetLogs, ...botBetLogs];
    }

    async settleRound({ roundId, time }) {
        try {
            const round = await this.queryRound(roundId);
            const betLogs = await this.queryBetLogs(roundId);

            if (!round || !betLogs) {
                this.logService.logError(`${this.definition.name} Settle Error: Invalid round data: ${roundId}`);
                return;
            }

            const betResult = this.calculateBetResult(round, betLogs);

            round.betwin = betResult.totalWin;
            round.paid = true;

            const { result, settlementResult, tapCount } = this.getMineResults(betLogs);
            round.result = result;
            round.settlementResult = settlementResult;
            round.tapCount = tapCount;

            await round.save();
            await this.callEndGame(round, roundId, time, betResult);
            await this.userBetResultPublisher.publish(round.uid, {
                ...betResult,
                reachMaxWin: betLogs?.some((log) => log.reachMaxWin),
            });
            this.updatePlayerBetTracks(round.name);

            this.provablyFairConsumer.generateServerSeedAndPublishHash(betTrack.uid, playerName);
        } catch (error) {
            this.logService?.logError(`Failed to settle round ${roundId}: ${error}`);
            throw error;
        }
    }

    updatePlayerBetTracks(playerName) {
        const playerGameData = this.gameData.ingame[playerName];

        if (playerGameData) {
            playerGameData.betTracks = {};
            playerGameData.activeBet = undefined;
        }
    }

    getMineResults(betLogs = []) {
        const result = [];
        const settlementResult = [];
        let tapCount = 0;

        betLogs
            .filter((betLog) => betLog.action === Actions.Mine)
            .forEach((betLog) => {
                result.push(betLog.result);
                settlementResult.push(betLog.result);
                tapCount += 1;
            });

        return { result, settlementResult, tapCount };
    }

    calculateWinAmount(betLogs = []) {
        const cashoutLog = betLogs?.find((betLog) => betLog.action === Actions.CashOut);

        if (!cashoutLog) return 0;

        return cashoutLog.amount * cashoutLog.multiplier;
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

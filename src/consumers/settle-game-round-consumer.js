import { EventConsumers } from "sc-game-base/src/table";
import { Actions } from "../constants";
import { decrypt } from "../helpers/crypto-helper";

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
        resultsRepository,
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
        this.resultsRepository = resultsRepository;
    }

    queryRound(roundId) {
        return this.roundsRepository.findOne({ id: roundId }).exec();
    }

    async queryBetLogs(roundId) {
        return this.betLogsRepository.find({ roundId }).lean().exec();
    }

    async settleRound({ roundId, time, player, playerName }) {
        try {
            const round = await this.queryRound(roundId);
            const result = await this.resultsRepository.findOne({ roundId }).lean().exec();
            const crashPoint = decrypt(result.encryptedFinalResult);
            const betLogs = await this.queryBetLogs(roundId);
            const cashOutLog = betLogs.find((log) => log.action === Actions.CashOut);

            if (!round || !cashOutLog || !result) {
                this.logService.logError(`${this.definition.name} Settle Error: Invalid round data: ${roundId}`);
                return;
            }

            const betResult = this.calculateBetResult(round, cashOutLog);

            round.betwin = betResult.totalWin;
            round.result = +crashPoint;
            round.paid = true;
            round.tapCount = betLogs.length - 1;
            round.multiplier = this.getMultiplier(cashOutLog);

            await this.callEndGame(round, round.id, time, betResult);
            await round.save();

            if (player) {
                await this.userBetResultPublisher.publish(player.UID, {
                    ...betResult,
                    rate: cashOutLog.rate,
                });
                this.updatePlayerBetTracks(round.name);
                this.gameData.ingame[playerName].betTracks = {};

                this.provablyFairConsumer.generateServerSeedAndPublishHash(player.UID, player.profile.name);
            }

            delete this.gameData.provablyFair[playerName];
            delete this.gameData.ingame[playerName]?.activeBet;
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

    getMultiplier(cashOutLog) {
        if (!cashOutLog) return 0;

        return cashOutLog.multiplier;
    }

    calculateBetResult(bet, cashOutLog) {
        const { amount } = bet;
        const winAmount = amount * this.getMultiplier(cashOutLog);
        const winLoss = winAmount - amount;

        return {
            totalBetAmount: +amount.toFixed(2),
            totalWin: +winAmount.toFixed(2),
            netWin: +(winLoss > 0 ? winLoss : 0).toFixed(2),
            totalLost: +(winLoss < 0 ? -winLoss : 0).toFixed(2),
        };
    }
}

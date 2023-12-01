import { Actions } from "../constants";
import { calculateCrashTimeInMillisecond } from "../helpers/crash-point-helper";
import { addMillisecond } from "../helpers/date-helper";
import { roundFloat } from "../helpers/number-helper";

export class SettleCashOutConsumer {
    /**
     * @param {Object} dependencies
     * @param {GameData} dependencies.gameData
     * @param {PlaceBetPublisher} dependencies.placeBetPublisher
     * @param {logger} dependencies.logService
     * @param {mongoose.Model} dependencies.betLogsRepository
     */
    constructor(gameData, placeBetPublisher, logService, betLogsRepository) {
        this.gameData = gameData;
        this.placeBetPublisher = placeBetPublisher;
        this.logService = logService;
        this.betLogsRepository = betLogsRepository;
    }
    async proceedAutoCashOut(multiplier) {
        try {
            const players = Object.values(this.gameData.ingame).filter((playerInGame) => !playerInGame.isUm);

            for (const player of players) {
                const betTracks = player?.betTracks;
                const isValid = this.validateAutoCashOut(betTracks, multiplier);

                if (isValid) {
                    const bet = betTracks?.[Actions.Bet];
                    const receivedTime = addMillisecond(this.gameData.startTime, calculateCrashTimeInMillisecond(bet.autoCashOut));
                    const cashOutAmount = betTracks[Actions.HalfCashOut] ? bet.amount / 2 : bet.amount;

                    const payload = {
                        roundId: this.gameData.roundId,
                        receivedTime,
                        action: Actions.CashOut,
                    };

                    betTracks[Actions.CashOut] = {
                        time: new Date(),
                    };

                    await this.settleCashOut(
                        player.playerData,
                        payload,
                        cashOutAmount,
                        bet.autoCashOut,
                        betTracks[Actions.HalfCashOut]?.win
                    );
                }
            }
        } catch (err) {
            this.logService.logError(err);
        }
    }

    validateAutoCashOut(betTracks, multiplier) {
        const { result } = this.gameData;
        const bet = betTracks?.[Actions.Bet];

        return bet?.autoCashOut <= multiplier && bet?.autoCashOut < result && !betTracks?.[Actions.CashOut];
    }

    async settleCashOut(player, payload, amount, multiplier, halfCashOutWinAmount = 0) {
        try {
            const { action, roundId } = payload;
            const cashOutWin = roundFloat(amount * multiplier);
            const maxWinPerRound = this.getMaxWinPerRound(player) - halfCashOutWinAmount;
            const winAmount = Math.min(cashOutWin, maxWinPerRound);
            const reachMaxWin = winAmount === maxWinPerRound;

            const betLog = { ...payload, winAmount, multiplier, amount, reachMaxWin };

            await this.insertBetLog(player, roundId, betLog);
            this.adjustRunningBets(player, action, amount, winAmount);
            this.placeBetPublisher.publishSuccessCashOut(
                player.UID,
                {
                    name: player.profile.name,
                    playerId: player.UID,
                    [action]: { amount, win: winAmount, multiplier },
                    reachMaxWin,
                },
                this.calculateCurrencyRate(player.session)
            );

            this.gameData.updatePlayerAction(player.UID, action, { amount, win: winAmount, multiplier });
        } catch (err) {
            this.logService.logError(err);
        }
    }

    adjustRunningBets(player, action, amount, win) {
        this.gameData.runningBets[player.UID] = { name: player.profile.name, playerId: player.UID, [action]: { amount, win } };
    }

    getMaxWinPerRound(player) {
        const { maxWinPerRound } = this.gameData.gameConfigs.crashConfig;
        const settings = this.gameData.currencyGroupGames.find((x) => x.groupId.toString() === player.session.currencyGroupId);
        const maxBet = Math.min(player.profile.maxBet, settings.maxBet);

        return maxWinPerRound * maxBet;
    }

    async insertBetLog(player, roundId, bet) {
        const rate = this.calculateCurrencyRate(player.session);

        const newBetLog = {
            uid: player.UID,
            name: player.profile.name,
            time: new Date(),
            action: bet.action,
            amount: bet.amount,
            winAmount: bet.winAmount,
            freeBet: bet.freeBet,
            clientSentTime: bet.clientSentTime,
            receivedTime: bet.receivedTime,
            roundId,
            multiplier: bet.multiplier,
            reachMaxWin: bet.reachMaxWin,
        };

        if (player.session) {
            newBetLog.siteId = player.session.siteId;
            newBetLog.currency = player.session.currencyName;
            newBetLog.rate = rate;

            newBetLog.operatorId = player.session.operatorId;
            newBetLog.playerId = player.session.playerId;
        }

        await this.betLogsRepository.create(newBetLog);
    }

    calculateCurrencyRate(session) {
        return session.multiplier * this.gameData.exchangeRates.code[session.currencyCode];
    }
}

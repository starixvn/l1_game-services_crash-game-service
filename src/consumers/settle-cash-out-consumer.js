import { Actions } from "../constants";
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

        //TODO should use specific publisher for cashout
        this.placeBetPublisher = placeBetPublisher;
        this.logService = logService;
        this.betLogsRepository = betLogsRepository;
    }
    //TODO call for player disconnected
    async proceedAutoCashOut(multiplier) {
        try {
            const players = Object.values(this.gameData.ingame).filter((playerInGame) => !playerInGame.isUm);

            for (const player of players) {
                const betTracks = player?.betTracks;
                const isValid = this.validateAutoCashOut(betTracks, multiplier);

                if (isValid) {
                    const bet = betTracks?.[Actions.Bet];
                    const payload = {
                        roundId: this.gameData.roundId,
                        receivedTime: new Date(),
                        action: Actions.CashOut,
                    };

                    betTracks[Actions.CashOut] = {
                        time: new Date(),
                    };

                    await this.settleCashOut(player.playerData, payload, bet.amount, bet.autoCashOut);
                }
            }
        } catch (err) {
            this.logService.logError(err);
        }
    }

    //TODO just verify player have existing bet or not
    validateAutoCashOut(betTracks, multiplier) {
        const { result } = this.gameData;
        const bet = betTracks?.[Actions.Bet];

        return bet?.autoCashOut <= multiplier && bet?.autoCashOut < result && !betTracks?.[Actions.CashOut];
    }

    async settleCashOut(player, payload, amount, multiplier) {
        try {
            const winningDetails = this.calculateWinnings(amount, multiplier, player);
            await this.recordBetLog(player, payload, winningDetails);
            await this.publishCashOut(player, payload, winningDetails);
            this.updateGameData(player, payload.action, winningDetails);

            await this.updateRounds(player, payload.action, winningDetails);
        } catch (err) {
            this.logService.logError(err);
            throw err;
        }
    }

    async recordBetLog(player, payload, winningDetails) {
        const betLog = { ...payload, ...winningDetails };
        await this.insertBetLog(player, this.gameData.roundId, betLog);
    }

    async publishCashOut(player, payload, winningDetails) {
        this.placeBetPublisher.publishSuccessCashOut(
            player.UID,
            {
                name: player.profile.name,
                playerId: player.UID,
                [payload.action]: winningDetails,
            },
            this.calculateCurrencyRate(player.session)
        );
    }

    async updateGameData(player, action, winningDetails) {
        this.gameData.updatePlayerAction(player.UID, action, winningDetails);
    }

    async updateRounds(player, action, winningDetails) {
        //TODO update rounds for settlement
    }

    calculateWinnings(amount, multiplier, player) {
        const cappedMultiplier = Math.min(multiplier, 1000);
        const cashOutWin = roundFloat(amount * cappedMultiplier);
        const maxWinPerRound = this.getMaxWinPerRound(player);
        const winAmount = Math.min(cashOutWin, maxWinPerRound);

        return {
            winAmount,
            multiplier: cappedMultiplier,
            cashOutWin,
            reachMaxWin: winAmount === maxWinPerRound,
        };
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
            clientSendTime: bet.clientSendTime,
            receivedTime: bet.receivedTime,
            roundId,
            multiplier: bet.multiplier,
            reachMaxWin: bet.reachMaxWin,
            tapCount: bet.tapCount,
            increment: 0,
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

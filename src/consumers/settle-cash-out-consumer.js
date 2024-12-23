import { Actions } from "../constants";
import helpers from "../helpers/notice-helper";

export class SettleCashOutConsumer {
    /**
     * @param {Object} dependencies
     * @param {GameData} dependencies.gameData
     * @param {SettleGameRoundConsumer} dependencies.settleGameRoundConsumer
     * @param {BaseEventPublisher} dependencies.baseEventPublisher
     * @param {logger} dependencies.logService
     * @param {mongoose.Model} dependencies.betLogsRepository
     */
    constructor(gameData, settleGameRoundConsumer, baseEventPublisher, logService, betLogsRepository) {
        this.gameData = gameData;
        this.settleGameRoundConsumer = settleGameRoundConsumer;
        this.baseEventPublisher = baseEventPublisher;
        this.logService = logService;
        this.betLogsRepository = betLogsRepository;
    }

    validateCashOut(player) {
        const playerData = this.gameData.ingame[player.profile.name];
        const betTracks = playerData?.betTracks;

        return betTracks?.[Actions.Bet] && !betTracks?.[Actions.CashOut];
    }

    async proceedCashOut(player, isAutoCashOut = false) {
        const isValidCashOut = this.validateCashOut(player);
        const bet = this.getCashOutBet(player);

        if (!isValidCashOut || !bet) {
            this.baseEventPublisher.publishToUser(player.UID, { endBet: -1, notice: helpers.invalidCashOut });

            return null;
        }

        const { multiplier, roundId, tapCount, amount } = bet;

        await this.insertBetLog(player, roundId, { multiplier, roundId, tapCount, amount, isAutoCashOut });
        this.updateGameData(player, { multiplier, roundId, tapCount });
        await this.settleGameRoundConsumer.settleRound({ roundId, time: new Date() });

        return { player, multiplier, roundId, tapCount, amount };
    }

    getCashOutBet(player) {
        const playerData = this.gameData.ingame[player.profile.name];
        const betTracks = playerData?.betTracks;
        const bet = betTracks?.[Actions.Bet];

        if (!bet) {
            return null;
        }

        return {
            multiplier: bet.multiplier,
            tapCount: bet.tapCount,
            roundId: bet.roundId,
            amount: bet.amount,
        };
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

    async updateGameData(player, bet) {
        const playerName = player.profile.name;
        const playerGameData = this.gameData.ingame[playerName];
        const playerBetTracks = playerGameData?.betTracks ?? {};

        playerBetTracks[Actions.CashOut] = {
            time: new Date(),
            multiplier: bet.multiplier,
            roundId: bet.roundId,
            tapCount: bet.tapCount,
        };
    }

    async insertBetLog(player, roundId, bet) {
        const rate = this.calculateCurrencyRate(player.session);

        const newBetLog = {
            uid: player.UID,
            name: player.profile.name,
            time: new Date(),
            action: Actions.CashOut,
            amount: bet.amount,
            clientSendTime: bet.clientSendTime,
            receivedTime: bet.receivedTime,
            roundId,
            multiplier: bet.multiplier,
            tapCount: bet.tapCount,
            isAutoCashOut: bet.isAutoCashOut,
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

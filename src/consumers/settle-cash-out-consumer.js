import { Actions } from "../constants";
import helpers from "../helpers/notice-helper";

export class SettleCashOutConsumer {
    /**
     * @param {Object} dependencies
     * @param {GameData} dependencies.gameData
     * @param {SettleGameRoundConsumer} dependencies.settleGameRoundConsumer
     * @param {BaseEventPublisher} dependencies.publisher
     * @param {logger} dependencies.logService
     * @param {mongoose.Model} dependencies.betLogsRepository
     */
    constructor(gameData, settleGameRoundConsumer, publisher, logService, betLogsRepository) {
        this.gameData = gameData;
        this.settleGameRoundConsumer = settleGameRoundConsumer;
        this.publisher = publisher;
        this.logService = logService;
        this.betLogsRepository = betLogsRepository;
    }

    validateCashOut(player) {
        const playerData = this.gameData.ingame[player.profile.name];
        const betTracks = playerData?.betTracks;
        const isHavingBet = betTracks?.[Actions.Bet];

        return isHavingBet;
    }

    async proceedCashOut(player, isAutoCashOut = false) {
        const isValidCashOut = this.validateCashOut(player) || isAutoCashOut;
        const bet = this.getCashOutBet(player);

        if (!isValidCashOut || !bet || !this.isValidCashOutBet(bet)) {
            this.publisher.publishToUser(player.UID, { endBet: -1, notice: helpers.invalidCashOut });

            return null;
        }

        const { multiplier, roundId, tapCount, amount } = bet;

        await this.insertBetLog(player, roundId, { multiplier, roundId, tapCount, amount, isAutoCashOut });
        this.updateGameData(player, { multiplier, roundId, tapCount });
        await this.settleGameRoundConsumer.settleRound({ roundId, time: new Date(), player, playerName: player.profile.name });

        return { player, multiplier, roundId, tapCount, amount };
    }

    isValidCashOutBet(bet) {
        const { roundId, tapCount, amount } = bet;

        return roundId && tapCount && amount;
    }

    getCashOutBet(player) {
        const activeBet = this.gameData.ingame[player.profile.name].activeBet;

        if (!activeBet) {
            return null;
        }

        return {
            multiplier: activeBet.currentMultiplier,
            tapCount: activeBet.tapCount,
            roundId: activeBet.roundId,
            amount: activeBet.amount,
        };
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
            clientSendTime: bet.clientSendTime ?? new Date(),
            receivedTime: bet.receivedTime ?? new Date(),
            roundId,
            multiplier: bet.multiplier,
            winAmount: bet.amount * bet.multiplier,
            tapCount: bet.tapCount,
            isAutoCashOut: bet.isAutoCashOut,
        };

        if (player.session) {
            newBetLog.siteId = player.session.siteId;
            newBetLog.currency = player.session.currencyName;
            newBetLog.currencyMultiplier = player.session.multiplier;
            newBetLog.rate = rate;
            newBetLog.currencyCode = player.session.currencyCode;
            newBetLog.operatorId = player.session.operatorId;
            newBetLog.playerId = player.session.playerId;
        }

        await this.betLogsRepository.create(newBetLog);
    }

    calculateCurrencyRate(session) {
        return session.multiplier * this.gameData.exchangeRates.code[session.currencyCode];
    }
}

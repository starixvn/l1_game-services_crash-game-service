import { Core } from "sc-game-base";
import { tracer } from "sc-instrument";
import { Actions } from "../constants";
import { calculateMultiplier } from "../helpers/crash-point-helper";
import noticeHelper from "../helpers/notice-helper";

export default class ProcessBetQueue extends Core.Crons.ProcessBetQueue {
    constructor({
        definition,
        gameData,
        placeBetPublisher,
        placeBet,
        logService,
        betsRepository,
        betLogsRepository,
        userInfosRepository,
        baseMetrics,
        settleCashOutConsumer,
        provablyFairConsumer,
    }) {
        super({
            definition,
            gameData,
            placeBetPublisher,
            placeBet,
            logService,
            betsRepository,
            betLogsRepository,
            userInfosRepository,
            baseMetrics,
        });

        this.settleCashOutConsumer = settleCashOutConsumer;
        this.provablyFairConsumer = provablyFairConsumer;
    }

    dequeueBets() {
        if (this.gameData.ingame) {
            Object.values(this.gameData.ingame).forEach((playerInGame) => {
                if (!playerInGame.betProcessing && playerInGame.betQueue && playerInGame.betQueue.length > 0) {
                    const self = this;
                    const { player, payload } = playerInGame.betQueue.shift();

                    playerInGame.betProcessing = true;

                    tracer.startActiveSpan("dequeueBet", async (span) => {
                        self.proceedActions(player, payload)
                            .then(() => (playerInGame.betProcessing = false))
                            .catch(self.logService.logError)
                            .finally(() => span.end());
                    });
                }
            });
        }
    }

    async proceedActions(player, payload) {
        switch (payload.action) {
            case Actions.Bet:
                await this.proceedBet(player, payload);
                break;
            case Actions.HalfCashOut:
                await this.proceedHalfCashOut(player, payload);
                break;
            case Actions.CashOut:
                await this.proceedCashOut(player, payload);
                break;
        }
    }

    async proceedCashOut(player, payload) {
        const { multiplier, bet, betLogs } = await this.getCashOutBet(payload, player);
        const isValidCashOut = this.validateCashOut(multiplier, bet, player, betLogs);

        if (!isValidCashOut) {
            return;
        }

        const halfCashOutBetLog = betLogs.find((log) => log.action === Actions.HalfCashOut);

        const amount = bet.amount - (halfCashOutBetLog?.amount ?? 0);

        await this.settleCashOutConsumer.settleCashOut(player, payload, amount, multiplier, halfCashOutBetLog?.winAmount);
    }

    async proceedHalfCashOut(player, payload) {
        const { multiplier, bet, betLogs } = await this.getCashOutBet(payload, player);
        const isValidCashOut = this.validateCashOut(multiplier, bet, player, betLogs);

        if (!isValidCashOut) {
            return;
        }

        const amount = bet.amount / 2;

        await this.settleCashOutConsumer.settleCashOut(player, payload, amount, multiplier);
    }

    async getCashOutBet(payload, player) {
        const { freeBet, roundId } = payload;
        const multiplier = this.calculateCashOutMultiplier(payload);
        const bet = await this.betsRepository.findOne({ uid: player.UID, roundId, freeBet: !!freeBet }).lean().exec();
        const betLogs = await this.betLogsRepository.find({ uid: player.UID, roundId }).lean().exec();

        return { multiplier, bet, roundId, freeBet, betLogs };
    }

    calculateCashOutMultiplier(payload) {
        const { receivedTime } = payload;
        const { startTime } = this.gameData;

        const timeFromStart = receivedTime - startTime;

        return calculateMultiplier(timeFromStart);
    }

    validateCashOut(multiplier, bet, player, betLogs) {
        const { result, roundId } = this.gameData;
        const cashOutBetLogs = betLogs.find((log) => log.action === Actions.CashOut);

        if (!bet || multiplier >= result || roundId !== bet.roundId || !!cashOutBetLogs) {
            this.publishCashOutFailed(player);

            return false;
        }

        return true;
    }
    publishCashOutFailed(player) {
        this.placeBetPublisher.publishGameFailedBet(player.UID, {
            endBet: -1,
            notice: { errorCode: noticeHelper.invalidCashOut },
        });
    }

    async handleSuccessBet(player, balance, roundId, bet) {
        const rate = this.calculateCurrencyRate(player.session);

        await this.insertBet(player, roundId, bet, rate);
        await this.insertBetLog(player, roundId, bet);

        this.notifyPlacingBetResult(player, balance, bet, rate);

        this.gameData.addPlayerToBetList(player.UID, { name: player.profile.name, amount: bet.amount, rate, autoCashOut: bet.autoCashOut });

        if (!bet.freeBet && (player.profile.minBet !== balance.minBet || player.profile.maxBet !== balance.maxBet)) {
            await this.updateUserStakeLevel(player, balance.minBet, balance.maxBet);
        }
    }

    generatePlacingBetResult(player, balance, bet, rate) {
        const { amount } = bet;
        const result = super.generatePlacingBetResult(player, balance, bet, rate);
        result.ownChip = { amount };
        result.user.name = player.profile.name;
        return result;
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

    async insertBet(player, roundId, bet, rate) {
        const newBet = {
            uid: player.UID,
            name: player.profile.name,
            time: new Date(),
            freeBet: bet.freeBet,
            roundId,
            amount: bet.amount,
            autoCashOut: bet.autoCashOut,
            clientSeed: bet.clientSeed,
            totalAmount: bet.amount,
        };

        if (player.session) {
            newBet.siteId = player.session.siteId;
            newBet.currency = player.session.currencyName;
            newBet.rate = rate;

            newBet.operatorId = player.session.operatorId;
            newBet.playerId = player.session.playerId;
        }

        await this.betsRepository.create(newBet);
        return newBet.time;
    }

    decreaseBetTracks(playerName) {
        if (this.gameData.ingame?.[playerName]) {
            const playerInGame = this.gameData.ingame[playerName];

            delete playerInGame.betTracks[Actions.Bet];
        }
    }
}

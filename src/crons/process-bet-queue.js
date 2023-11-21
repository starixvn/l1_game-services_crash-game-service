import { Core } from "sc-game-base";
import { Actions } from "../constants";
import { calculateMultiplier } from "../helpers/crash-point-helper";
import noticeHelper from "../helpers/notice-helper";
import { roundFloat } from "../helpers/number-helper";

export default class ProcessBetQueue extends Core.Crons.ProcessBetQueue {
    dequeueBets() {
        if (this.gameData.ingame) {
            Object.values(this.gameData.ingame).forEach((playerInGame) => {
                if (!playerInGame.betProcessing && playerInGame.betQueue && playerInGame.betQueue.length > 0) {
                    const { player, payload } = playerInGame.betQueue.shift();

                    playerInGame.betProcessing = true;
                    this.proceedActions(player, payload)
                        .then(() => (playerInGame.betProcessing = false))
                        .catch(this.logService.logError);
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
        const { freeBet, roundId } = payload;
        const multiplier = this.calculateCashOutMultiplier(payload);
        const bet = await this.betsRepository.findOne({ uid: player.UID, roundId, freeBet: !!freeBet }).lean().exec();
        const isValidCashOut = this.validateCashOut(multiplier, bet, player);

        if (isValidCashOut) {
            const halfCashOutBetLog = await this.betLogsRepository
                .findOne({ uid: player.UID, roundId, freeBet, action: Actions.HalfCashOut })
                .lean()
                .exec();

            const amount = bet.amount - (halfCashOutBetLog?.amount ?? 0);

            await this.settleCashOut(player, payload, amount, multiplier, halfCashOutBetLog?.winAmount);
        }
    }

    async proceedHalfCashOut(player, payload) {
        const { freeBet, roundId } = payload;
        const multiplier = this.calculateCashOutMultiplier(payload);
        const bet = await this.betsRepository.findOne({ uid: player.UID, roundId, freeBet: !!freeBet }).lean().exec();
        const isValidCashOut = this.validateCashOut(multiplier, bet);

        if (isValidCashOut) {
            const amount = bet.amount / 2;

            await this.settleCashOut(player, payload, amount, multiplier);
        }
    }

    calculateCashOutMultiplier(payload) {
        const { receivedTime } = payload;
        const { startTime } = this.gameData;

        const timeFromStart = receivedTime - startTime;

        return calculateMultiplier(timeFromStart);
    }

    validateCashOut(multiplier, bet, player) {
        const { result } = this.gameData;

        if (!bet || multiplier >= result) {
            this.publishCashOutFailed(player);

            return false;
        }

        return true;
    }

    async settleCashOut(player, payload, amount, multiplier, halfCashOutWinAmount = 0) {
        const { action, roundId } = payload;
        const cashOutWin = roundFloat(amount * multiplier);
        const maxWinPerRound = this.getMaxWinPerRound(player) - halfCashOutWinAmount;
        const winAmount = Math.min(cashOutWin, maxWinPerRound);

        const betLog = { ...payload, winAmount, multiplier, amount };

        await this.insertBetLog(player, roundId, betLog);
        this.adjustRunningBets(player, action, amount, winAmount);
        this.placeBetPublisher.publishSuccessCashOut(
            player.UID,
            {
                name: player.profile.name,
                playerId: player.UID,
                [action]: { amount, win: winAmount, multiplier },
                reachMaxWin: winAmount === maxWinPerRound,
            },
            this.calculateCurrencyRate(player.session)
        );

        this.gameData.updatePlayerAction(player.UID, action, { amount, win: finalWinAmount, multiplier });
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

        this.notifyPlacingBetResult(player, balance, bet, rate);

        this.adjustRunningBets(player, bet.action, bet.amount);

        this.gameData.addPlayerToBetList(player.UID, { name: player.profile.name, amount: bet.amount, rate });

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
            clientSentTime: bet.clientSentTime,
            receivedTime: bet.receivedTime,
            roundId,
            multiplier: bet.multiplier,
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
        };

        if (player.session) {
            newBet.siteId = player.session.siteId;
            newBet.currency = player.session.currencyName;
            newBet.rate = rate;

            newBet.operatorId = player.session.operatorId;
            newBet.playerId = player.session.playerId;
        }

        await this.betsRepository.create(newBet);
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
}

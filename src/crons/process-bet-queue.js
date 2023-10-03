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
            case Actions.CashOut:
                await this.proceedCashOut(player, payload);
                break;
        }
    }

    async proceedCashOut(player, payload) {
        const { receivedTime, freeBet, action } = payload;
        const { roundId, startTime, result } = this.gameData;

        const bet = await this.betsRepository.findOne({ uid: player.UID, roundId, freeBet: freeBet }).lean().exec();

        if (!bet) {
            this.publishCashOutFailed(player);

            return;
        }

        const isCashOutHalfAmount = await this.isCashOutHalfAmount(player, payload);
        const amount = isCashOutHalfAmount ? bet.amount / 2 : bet.amount;
        const timeFromStart = receivedTime - startTime;
        const multiplier = calculateMultiplier(timeFromStart);

        if (multiplier >= result) {
            this.publishCashOutFailed(player);
        } else {
            const winAmount = roundFloat(amount * multiplier);
            const betLog = { ...payload, winAmount: winAmount };

            await this.insertBetLog(player, roundId, betLog);
            this.adjustRunningBets(player, action, amount, winAmount);
            this.placeBetPublisher.publishSuccessBet(player.UID, {
                name: player.profile.name,
                playerId: player.UID,
                [action]: { amount, win: winAmount },
            });
        }
    }

    async isCashOutHalfAmount(player, payload) {
        const { action, roundId, freeBet } = payload;

        if (action === Actions.HalfCashOut) {
            return true;
        } else {
            const halfCashOutBetLog = await this.betLogsRepository
                .findOne({ uid: player.UID, roundId, freeBet, action: Actions.HalfCashOut })
                .lean()
                .exec();

            return halfCashOutBetLog;
        }
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

        // gameData
        this.adjustRunningBets(player, bet.action, bet.amount);

        if (!bet.freeBet && (player.profile.minBet !== balance.minBet || player.profile.maxBet !== balance.maxBet)) {
            await this.updateUserStakeLevel(player, balance.minBet, balance.maxBet);
        }
    }

    async insertBetLog(player, roundId, bet, rate) {
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
}

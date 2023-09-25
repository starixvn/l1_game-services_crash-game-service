import { Core } from "sc-game-base";
import { Actions } from "../constants";
import { calculateMultiplier } from "../helpers/crash-point-helper";
import noticeHelper from "../helpers/notice-helper";

export default class ProcessBetQueue extends Core.Crons.ProcessBetQueue {
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
    async proceedHalfCashOut(player, payload) {
        const { receivedTime, freeBet } = payload;
        const { roundId } = this.gameData;

        const bet = await this.betsRepository.findOne({ uid: player.UID, roundId, freeBet }).lean().exec();

        if (!bet) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, {
                endBet: -1,
                notice: { errorCode: noticeHelper.invalidCashOut },
            });

            return;
        }

        const amount = bet.amount / 2;
        const timeFromStart = receivedTime - this.gameData.startTime;
        const winAmount = amount * calculateMultiplier(timeFromStart);
        const betLog = { ...payload, winAmount };

        await this.insertBetLog(betLog);

        this.publishSuccessBet(player.UID, { [Actions.HalfCashOut]: { amount, win: winAmount } });
    }

    async proceedCashOut(player, payload) {
        const { receivedTime } = payload;
        const { roundId } = this.gameData;

        const bet = await this.betsRepository.findOne({ uid: player.UID, roundId, freeBet: bet.freeBet }).lean().exec();
        const halfCashOutBetLog = await this.betLogsRepository
            .findOne({ uid: player.UID, roundId, freeBet: bet.freeBet, action: Actions.HalfCashOut })
            .lean()
            .exec();

        if (!bet) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, {
                endBet: -1,
                notice: { errorCode: noticeHelper.invalidCashOut },
            });

            return;
        }

        const amount = halfCashOutBetLog ? bet.amount / 2 : bet.amount;
        const timeFromStart = receivedTime - this.gameData.startTime;
        const winAmount = amount * calculateMultiplier(timeFromStart);
        const betLog = { ...payload, winAmount };

        await this.insertBetLog(betLog);

        this.publishSuccessBet(player.UID, { [Actions.CashOut]: { amount, win: winAmount } });
    }

    async handleSuccessBet(player, balance, roundId, bet) {
        const rate = this.calculateCurrencyRate(player.session);

        await this.insertBetLog(player, roundId, bet, rate);
        await this.insertBet(player, roundId, bet, rate);

        this.notifyPlacingBetResult(player, balance, bet, rate);

        if (!bet.freeBet && (player.profile.minBet !== balance.minBet || player.profile.maxBet !== balance.maxBet)) {
            await this.updateUserStakeLevel(player, balance.minBet, balance.maxBet);
        }
    }

    formatApiBetInfo(payload) {
        return {
            amount: payload.amount,
            gameId: this.definition.id,
            gameRoundId: payload.roundId,
            freeBet: payload.freeBet,
            clientSentTime: payload.time ?? new Date(),
            metadata: {
                mode: `${payload.mode}`,
            },
        };
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
}

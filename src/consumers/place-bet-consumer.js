import { BaseEventConsumers } from "sc-game-base/src/core";
import { Actions, MultiplierValues } from "../constants";
import { helpers } from "sc-common";
import noticeHelper from "../helpers/notice-helper";

export class PlaceBetConsumer extends BaseEventConsumers.PlaceBetConsumer {
    consume(player, payload) {
        Object.assign(payload, {
            amount: payload.amount >> 0,
            autoCashOut: payload.autoCashOut >> 0 ?? 0,
            freeBet: payload.freeBet ?? false,
            roundId: payload.roundId ?? this.gameData.roundId,
            mode: payload.m ?? this.DisplayMode.Landscape,
            action: Actions.Bet,
            receivedTime: new Date(),
        });

        const { amount, freeBet, roundId, autoCashOut } = payload;
        const name = player.profile.name;

        if (!this.validateBetRequest(player, amount, freeBet, roundId, autoCashOut)) {
            return;
        }

        if (!this.gameData.ingame[name]) {
            const newPlayer = {
                name: player.profile.name,
                currency: player.session.currencyName,
                system: player.session.system,
                betTracks: {},
                betQueue: [],
                operatorId: player.session.operatorId,
            };

            this.gameData.ingame[name] = newPlayer;
        }

        this.adjustBetTracks(player.profile.name, payload);

        this.gameData.ingame[name].betQueue.push({ player, payload });
    }

    validateBetRequest(player, amount, freeBet, roundId, autoCashOut) {
        if (!amount) {
            return false;
        }

        const criteria = this.composeValidationCriteria(player, amount, freeBet, roundId, autoCashOut);
        const failedCriterion = criteria.find((criterion) => criterion.failure);

        if (failedCriterion) {
            this.publisher.publishToUser(player.UID, { endBet: -1, notice: failedCriterion.notice });

            return false;
        }

        return true;
    }

    composeValidationCriteria(player, amount, freeBet, roundId, autoCashOut) {
        const bettingTimeValidationCriteria = this.composeBettingTimeValidationCriteria(roundId) ?? [];
        const betAmountValidationCriteria = this.composeBetAmountValidationCriteria(player, amount, freeBet, autoCashOut) || [];

        return bettingTimeValidationCriteria.concat(betAmountValidationCriteria);
    }

    composeBettingTimeValidationCriteria(roundId) {
        const configs = this.gameData.gameConfigs;

        return [
            {
                failure: !configs.enabled,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet),
            },
            {
                failure: roundId !== this.gameData.roundId,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet, { gameRoundId: roundId }),
            },
            {
                failure:
                    this.gameData.remainingTime <= this.definition.durations.lockingBet ||
                    this.gameData.remainingTime > this.definition.durations.placingBets,
                notice: this.getNoticeObj(helpers.noticeHelper.placeBetNextRound),
            },
        ];
    }

    composeBetAmountValidationCriteria(player, amount, freeBet, autoCashOut) {
        const settings = this.gameData.currencyGroupGames.find((x) => x.groupId.toString() === player.session.currencyGroupId);
        const configs = this.gameData.gameConfigs;
        const minBet = Math.max(player.profile.minBet, settings.minBet);
        const maxBet = Math.min(player.profile.maxBet, settings.maxBet);

        return [
            {
                failure: freeBet && !configs.enableFreeBet,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet),
            },
            {
                failure: amount < minBet,
                notice: this.getNoticeObj(helpers.noticeHelper.minBet, { minBet }),
            },
            {
                failure: amount > maxBet,
                notice: this.getNoticeObj(helpers.noticeHelper.maxBet, { maxBet }),
            },
            {
                failure: !MultiplierValues.includes(autoCashOut),
                notice: this.getNoticeObj(noticeHelper.invalidValueCashOut, { autoCashOut }),
            },
        ];
    }

    adjustBetTracks(playerName, bet) {
        const { amount, receivedTime, autoCashOut } = bet;

        if (this.gameData.ingame?.[playerName]) {
            const playerInGame = this.gameData.ingame[playerName];

            playerInGame.betTracks[Actions.Bet] = {
                amount,
                time: receivedTime,
            };
            if (autoCashOut > 0) {
                playerInGame.betTracks[Actions.Bet].autoCashOut = autoCashOut;
            }
        }
    }
}

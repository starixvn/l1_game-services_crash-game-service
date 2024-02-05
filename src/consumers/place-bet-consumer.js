import { helpers } from "sc-common";
import { BaseEventConsumers } from "sc-game-base/src/core";
import { verifySeed } from "sc-pf-client-seed";
import { PFNoticeHelper } from "sc-provably-fair";
import { Actions, MinMultiplierValue } from "../constants";
import noticeHelper from "../helpers/notice-helper";
import { roundFloat } from "../helpers/number-helper";

export class PlaceBetConsumer extends BaseEventConsumers.PlaceBetConsumer {
    consume(player, payload) {
        Object.assign(payload, {
            amount: payload.amount >> 0,
            autoCashOut: roundFloat(payload.autoCashOut ?? 0),
            clientSendTime: payload.clientSendTime,
            freeBet: payload.freeBet ?? false,
            roundId: payload.roundId ?? this.gameData.roundId,
            mode: payload.m ?? this.DisplayMode.Landscape,
            action: Actions.Bet,
            receivedTime: new Date(),
        });

        const { amount, freeBet, roundId, autoCashOut, clientSeed } = payload;
        const name = player.profile.name;

        if (!this.validateBetRequest(player, amount, freeBet, roundId, autoCashOut, clientSeed)) {
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
                playerData: { ...player },
            };

            this.gameData.ingame[name] = newPlayer;
        }

        this.adjustBetTracks(player.profile.name, payload);

        this.gameData.ingame[name].betQueue.push({ player, payload });
    }

    validateBetRequest(player, amount, freeBet, roundId, autoCashOut, clientSeed) {
        if (!amount) {
            return false;
        }

        const criteria = this.composeValidationCriteria(player, amount, freeBet, roundId, autoCashOut, clientSeed);
        const failedCriterion = criteria.find((criterion) => criterion.failure);

        if (failedCriterion) {
            this.publisher.publishToUser(player.UID, { endBet: -1, notice: failedCriterion.notice });

            return false;
        }

        return true;
    }

    composeValidationCriteria(player, amount, freeBet, roundId, autoCashOut, clientSeed) {
        const bettingTimeValidationCriteria = this.composeBettingTimeValidationCriteria(roundId) ?? [];
        const betAmountValidationCriteria = this.composeBetAmountValidationCriteria(player, amount, freeBet, autoCashOut) || [];
        const clientSeedValidationCriteria = this.composeClientSeedValidationCriteria(clientSeed);

        return bettingTimeValidationCriteria.concat(betAmountValidationCriteria, clientSeedValidationCriteria);
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
                    this.gameData.remainingTime < this.definition.durations.lockingBet ||
                    this.gameData.remainingTime >= this.definition.durations.placingBets,
                notice: this.getNoticeObj(helpers.noticeHelper.placeBetNextRound),
            },
        ];
    }

    composeBetAmountValidationCriteria(player, amount, freeBet, autoCashOut) {
        const settings = this.gameData.currencyGroupGames.find((x) => x.groupId.toString() === player.session.currencyGroupId);
        const configs = this.gameData.gameConfigs;
        const minBet = Math.max(player.profile.minBet, settings.minBet);
        const maxBet = Math.min(player.profile.maxBet, settings.maxBet);
        const playerIngame = this.gameData.ingame[player.profile.name];

        return [
            {
                failure: !!playerIngame?.betTracks[Actions.Bet],
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet),
            },
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
                failure: autoCashOut && (autoCashOut < MinMultiplierValue || autoCashOut > configs.crashConfig.maxMultiplier),
                notice: this.getNoticeObj(noticeHelper.invalidValueCashOut, { autoCashOut }),
            },
        ];
    }

    composeClientSeedValidationCriteria(clientSeed) {
        return [
            {
                failure: !verifySeed(clientSeed),
                notice: this.getNoticeObj(PFNoticeHelper.invalidClientSeed),
            },
        ];
    }

    adjustBetTracks(playerName, bet) {
        const { amount, receivedTime, autoCashOut, action } = bet;

        if (this.gameData.ingame?.[playerName]) {
            const playerInGame = this.gameData.ingame[playerName];

            playerInGame.betTracks[action] = {
                amount,
                time: receivedTime,
                autoCashOut: autoCashOut > 0 ? autoCashOut : undefined,
            };
        }
    }
}

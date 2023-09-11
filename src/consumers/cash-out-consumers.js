import { BaseEventConsumers } from "sc-game-base/src/core";
import { Actions } from "../constants";

export class CashOutConsumer extends BaseEventConsumers.PlaceBetConsumer {
    consume(player, payload) {
        Object.assign(payload, {
            roundId: payload.roundId ?? this.gameData.roundId,
            mode: payload.m ?? this.DisplayMode.Landscape,
            receivedTime: new Date(),
        });

        const { freeBet, roundId } = payload;
        const name = player.profile.name;

        if (!this.validateRequest(player, freeBet, roundId)) {
            return;
        }

        this.adjustBetTracks(player.profile.name, payload);

        this.gameData.ingame[name].betQueue.push({ player, payload });
    }

    validateRequest(player, roundId) {
        const name = player.profile.name;
        const configs = this.gameData.gameConfigs;
        const inGame = this.gameData.ingame?.[playerName];

        const criteria = [
            {
                failure: !configs.enabled,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet),
            },
            {
                failure: !this.gameData.ingame[name],
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet),
            },
            {
                failure: !inGame[Actions.Bet]?.time,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet),
            },
            {
                failure: roundId !== this.gameData.roundId,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet, { gameRoundId: roundId }),
            },
            {
                // Check is cashout time
                failure:
                    this.gameData.remainingTime < this.definition.durations.lockingBet ||
                    this.gameData.remainingTime >= this.definition.durations.placingBets,
                notice: this.getNoticeObj(helpers.noticeHelper.placeBetNextRound),
            },
        ];

        const failedCriterion = criteria.find((criterion) => criterion.failure);

        if (failedCriterion) {
            this.publisher.publishToUser(player.UID, { endBet: -1, notice: failedCriterion.notice });

            return false;
        }

        return true;
    }

    adjustBetTracks(playerName, bet) {
        const { receivedTime } = bet;

        if (this.gameData.ingame?.[playerName]) {
            const playerInGame = this.gameData.ingame[playerName];

            playerInGame.betTracks[Actions.CashOut] = {
                time: receivedTime,
            };
        }
    }
}

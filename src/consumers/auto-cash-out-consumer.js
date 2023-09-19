import { BaseEventConsumers } from "sc-game-base/src/core";
import { Actions } from "../constants";
import { helpers } from "sc-common";

export class AutoCashOutConsumer extends BaseEventConsumers.PlaceBetConsumer {
    consume(player, payload) {
        Object.assign(payload, {
            autoCashOut: payload.autoCashOut,
            roundId: payload.roundId ?? this.gameData.roundId,
            mode: payload.m ?? this.DisplayMode.Landscape,
            receivedTime: new Date(),
        });

        const { roundId } = payload;

        if (!this.validateRequest(player, roundId, autoCashOut)) {
            return;
        }
        this.publisher.publishToUser(player.UID, { autoCashOut });
        this.adjustBetTracks(player.profile.name, payload);
    }

    validateRequest(player, roundId, autoCashOut) {
        if (!autoCashOut) {
            return;
        }

        const configs = this.gameData.gameConfigs;
        const criteria = [
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
                    this.gameData.remainingTime > this.definition.durations.placingBet ||
                    this.gameData.remainingTime <= this.definition.durations.lockingBet,
                notice: this.getNoticeObj(helpers.noticeHelper.cannotEnableAutoCashOut),
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
        const { autoCashOut } = bet;

        if (this.gameData.ingame?.[playerName]) {
            const playerInGame = this.gameData.ingame[playerName];

            playerInGame.betTracks[Actions.Bet].autoCashOut = autoCashOut;
        }
    }
}

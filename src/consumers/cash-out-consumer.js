import { BaseEventConsumers } from "sc-game-base/src/core";
import { Actions, MaxDeltaTime } from "../constants";
import noticeHelper from "../helpers/notice-helper";

export class CashOutConsumer extends BaseEventConsumers.PlaceBetConsumer {
    consume(player, payload) {
        Object.assign(payload, {
            roundId: payload.roundId ?? this.gameData.roundId,
            m: payload.m,
            clientSendTime: payload.clientSendTime,
            mode: payload.m ?? this.DisplayMode.Landscape,
            receivedTime: new Date(),
            action: payload.halfCashOut ? Actions.HalfCashOut : Actions.CashOut,
        });

        const { roundId, halfCashOut, clientSendTime, receivedTime } = payload;
        const name = player.profile.name;

        if (!this.validateRequest(player, roundId, halfCashOut, clientSendTime, receivedTime)) {
            return;
        }

        this.adjustBetTracks(player.profile.name, payload);

        this.gameData.ingame[name].betQueue.push({ player, payload });
    }

    validateRequest(player, roundId, halfCashOut, clientSendTime, receivedTime) {
        const name = player.profile.name;
        const configs = this.gameData.gameConfigs;
        const inGame = this.gameData.ingame?.[name];
        const deltaTime = receivedTime - clientSendTime;
        const criteria = [
            {
                failure: !configs.enabled,
                notice: this.getNoticeObj(noticeHelper.invalidCashOut),
            },
            {
                failure: !inGame?.[Actions.Bet]?.time,
                notice: this.getNoticeObj(noticeHelper.invalidCashOut),
            },
            {
                failure: inGame?.[Actions.CashOut]?.time,
                notice: this.getNoticeObj(noticeHelper.invalidCashOut),
            },
            {
                failure: halfCashOut && inGame?.[Actions.HalfCashOut]?.time,
                notice: this.getNoticeObj(noticeHelper.invalidCashOut),
            },
            {
                failure: roundId !== this.gameData.roundId,
                notice: this.getNoticeObj(noticeHelper.invalidCashOut, { gameRoundId: roundId }),
            },
            {
                failure: this.gameData.remainingTime > this.definition.durations.liveTime,
                notice: this.getNoticeObj(noticeHelper.invalidCashOut),
            },
            {
                failure: deltaTime < 0 || deltaTime > MaxDeltaTime,
                notice: this.getNoticeObj(noticeHelper.invalidCashOut),
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
        const { receivedTime, action } = bet;

        if (this.gameData.ingame?.[playerName]) {
            const playerInGame = this.gameData.ingame[playerName];

            playerInGame.betTracks[action] = {
                time: receivedTime,
            };
        }
    }
}

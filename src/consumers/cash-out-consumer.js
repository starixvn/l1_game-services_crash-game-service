import { BaseEventConsumers } from "sc-game-base/src/core";
import { Actions, MaxDeltaTime } from "../constants";
import noticeHelper from "../helpers/notice-helper";

export class CashOutConsumer extends BaseEventConsumers.PlaceBetConsumer {
    consume(player, payload) {
        Object.assign(payload, {
            roundId: payload.roundId ?? this.gameData.roundId,
            m: payload.multiplier,
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
        const criteria = this.composeValidationCriteria(roundId, player, halfCashOut, clientSendTime, receivedTime);
        const failedCriterion = criteria.find((criterion) => criterion.failure);

        if (failedCriterion) {
            this.publisher.publishToUser(player.UID, { endBet: -1, notice: failedCriterion.notice });
            console.log(JSON.stringify(criteria));
            return false;
        }

        return true;
    }

    composeValidationCriteria(roundId, player, isHalfCashOut, clientSendTime, receivedTime) {
        const name = player.profile.name;
        const betTracks = this.gameData.ingame?.[name]?.betTracks;

        const bettingTimeValidationCriteria = this.composeBettingTimeValidationCriteria(roundId, clientSendTime, receivedTime);
        const betTrackValidationCriteria = this.composeBetTrackValidationCriteria(betTracks, isHalfCashOut);

        return bettingTimeValidationCriteria.concat(betTrackValidationCriteria);
    }

    composeBetTrackValidationCriteria(betTracks, isHalfCashOut) {
        return [
            {
                failure: !betTracks?.[Actions.Bet]?.time,
                notice: this.getNoticeObj(noticeHelper.invalidCashOut),
            },
            {
                failure: !!betTracks?.[Actions.CashOut]?.time,
                notice: this.getNoticeObj(noticeHelper.invalidCashOut),
            },
            {
                failure: isHalfCashOut && betTracks?.[Actions.HalfCashOut]?.time,
                notice: this.getNoticeObj(noticeHelper.invalidCashOut),
            },
        ];
    }

    composeBettingTimeValidationCriteria(roundId, clientSendTime, receivedTime) {
        const configs = this.gameData.gameConfigs;
        const deltaTime = receivedTime - clientSendTime;

        return [
            {
                failure: !configs.enabled,
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

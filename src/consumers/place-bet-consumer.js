import { Core } from "sc-game-base";
import { helpers } from "sc-common";
import { Actions } from "../constants";

export default class PlaceBetConsumer extends Core.BaseEventConsumers.PlaceBetConsumer {
    composeValidationCriteria(player, amount) {
        const bettingTimeValidationCriteria = this.composeBettingTimeValidationCriteria(player);
        const betAmountValidationCriteria = this.composeBetAmountValidationCriteria(player, amount);

        return bettingTimeValidationCriteria.concat(betAmountValidationCriteria);
    }

    composeBettingTimeValidationCriteria(player) {
        //TODO: consider using the Bet consumer for both Bet and Mine action
        //TODO: if so, need to check runningRound to determine action Bet or Mine
        const runningRound = this.gameData.ingame[player.profile.name]?.betTracks;
        const configs = this.gameData.gameConfigs;

        return [
            {
                failure: !configs.enabled || !!runningRound,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet),
            },
        ];
    }

    composeBetAmountValidationCriteria(player, amount) {
        const settings = this.gameData.currencyGroupGames.find((x) => x.groupId.toString() === player.session.currencyGroupId);
        const minBet = Math.max(player.profile.minBet, settings.minBet);
        const maxBet = Math.min(player.profile.maxBet, settings.maxBet);

        return [
            {
                failure: amount < minBet,
                notice: this.getNoticeObj(helpers.noticeHelper.minBet, { minBet }),
            },
            {
                failure: amount > maxBet,
                notice: this.getNoticeObj(helpers.noticeHelper.maxBet, { maxBet }),
            },
        ];
    }

    validateBetRequest(player, amount) {
        const criteria = this.composeValidationCriteria(player, amount);
        const failedCriterion = criteria.find((criterion) => criterion.failure);

        if (failedCriterion) {
            this.publisher.publishToUser(player.UID, { endBet: -1, notice: failedCriterion.notice });

            return false;
        }

        return true;
    }

    consume(player, payload) {
        //TODO: do not increment roundId here, it should be done in ProcessBetQueue
        const currentRoundId = this.gameData.roundId;
        this.gameData.roundId++;

        Object.assign(payload, {
            amount: payload.amount >> 0,
            receivedTime: new Date(),
            mode: payload.m ?? this.DisplayMode.Landscape,
            roundId: currentRoundId,
        });

        if (!this.validateBetRequest(player, payload.amount)) {
            return;
        }

        const name = player.profile.name;
        if (!this.gameData.ingame[name]) {
            const { currencyName: currency, system, operatorId } = player.session;
            const newPlayer = {
                name,
                currency,
                system,
                operatorId,
                betTracks: {},
                betQueue: [],
            };

            this.gameData.ingame[name] = newPlayer;
        }

        if (!this.gameData.ingame[name].betQueue) {
            this.gameData.ingame[name].betQueue = [];
        }

        this.gameData.ingame[name].betQueue.push({ player, payload: { action: Actions.Bet, bet: payload } });
    }
}

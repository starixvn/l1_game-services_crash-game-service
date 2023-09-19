import { BaseEventConsumers } from "sc-game-base/src/core";
import { Actions } from "../constants";
import { helpers } from "sc-common";

export class CancelBetConsumer extends BaseEventConsumers.PlaceBetConsumer {
    constructor(definition, gameData, publisher, earlyBetsRepository) {
        super(definition, gameData, publisher);
        this.earlyBetsRepository = earlyBetsRepository;
    }

    async consume(player, payload) {
        Object.assign(payload, {
            mode: payload.m ?? this.DisplayMode.Landscape,
            receivedTime: new Date(),
        });

        const name = player.profile.name;

        if (!this.validateBetRequest(player)) {
            return;
        }
        this.publisher.publishToUser(player.UID, { cancelBet: true });
        if (!this.gameData.ingame[name]) {
            return;
        }

        this.cancelEarlyBet(name, payload);
        await this.updateEarlyBetRecord(player, payload);
    }

    validateBetRequest(player) {
        const criteria = this.composeValidationCriteria(player);
        const failedCriterion = criteria.find((criterion) => criterion.failure);

        if (failedCriterion) {
            this.publisher.publishToUser(player.UID, { endBet: -1, notice: failedCriterion.notice });

            return false;
        }

        return true;
    }

    composeValidationCriteria(player) {
        const bettingTimeValidationCriteria = this.composeBettingTimeValidationCriteria() ?? [];
        const betAmountValidationCriteria = this.composeBetAmountValidationCriteria(player) || [];

        return bettingTimeValidationCriteria.concat(betAmountValidationCriteria);
    }

    composeBettingTimeValidationCriteria() {
        return [
            {
                failure:
                    this.gameData.remainingTime >= this.definition.durations.liveTime &&
                    this.gameData.remainingTime <= this.definition.durations.placingBets,
                notice: this.getNoticeObj(helpers.noticeHelper.cannotCancelBet),
            },
        ];
    }

    composeBetAmountValidationCriteria(player) {
        const { earlyBet } = this.gameData.ingame[player.profile.name] || { earlyBet: {} };

        return [
            {
                failure: Object.keys(earlyBet).length === 0,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet),
            },
        ];
    }

    cancelEarlyBet(playerName) {
        if (this.gameData.ingame?.[playerName]) {
            const playerInGame = this.gameData.ingame[playerName];

            delete playerInGame.earlyBet;
        }
    }

    async updateEarlyBetRecord(player, earlyBet) {
        const { receivedTime } = earlyBet;
        const roundId = this.gameData.roundId + 1;
        const operatorId = player.session?.operatorId;
        let existingEarlyBet = await this.earlyBetsRepository.findOne({ roundId, uid: player.UID, operatorId }).lean().exec();

        const action = {
            action: Actions.CancelBet,
            time: receivedTime,
        };

        if (existingEarlyBet) {
            existingEarlyBet.actions.push(action);
            await existingEarlyBet.save();
        }
    }
}

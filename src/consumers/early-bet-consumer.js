import { BaseEventConsumers } from "sc-game-base/src/core";
import { Actions } from "../constants";
import { helpers } from "sc-common";

export class EarlyBetConsumer extends BaseEventConsumers.PlaceBetConsumer {
    constructor(definition, gameData, publisher, earlyBetsRepository) {
        super(definition, gameData, publisher);
        this.earlyBetsRepository = earlyBetsRepository;
    }

    async consume(player, payload) {
        Object.assign(payload, {
            amount: payload.amount >> 0,
            freeBet: payload.freeBet ?? false,
            roundId: payload.roundId ?? this.gameData.roundId,
            mode: payload.m ?? this.DisplayMode.Landscape,
            receivedTime: new Date(),
        });

        const { amount, freeBet, roundId } = payload;
        const name = player.profile.name;

        if (!this.validateBetRequest(player, amount, freeBet, roundId)) {
            return;
        }
        this.publisher.publishToUser(player.UID, { earlyBet: amount });
        if (!this.gameData.ingame[name]) {
            const newPlayer = {
                name: player.profile.name,
                currency: player.session.currencyName,
                system: player.session.system,
                betTracks: {},
                betQueue: [],
                operatorId: player.session.operatorId,
                earlyBet: {},
            };

            this.gameData.ingame[name] = newPlayer;
        }

        this.adjustEarlyBet(name, payload);
        await this.updateEarlyBetRecord(player, payload);
    }

    validateBetRequest(player, amount, freeBet, roundId) {
        if (!amount) {
            return false;
        }

        const criteria = this.composeValidationCriteria(player, amount, freeBet, roundId);
        const failedCriterion = criteria.find((criterion) => criterion.failure);

        if (failedCriterion) {
            this.publisher.publishToUser(player.UID, { endBet: -1, notice: failedCriterion.notice });

            return false;
        }

        return true;
    }

    composeValidationCriteria(player, amount, freeBet, roundId) {
        const bettingTimeValidationCriteria = this.composeBettingTimeValidationCriteria(roundId) ?? [];
        const betAmountValidationCriteria = this.composeBetAmountValidationCriteria(player, amount, freeBet) || [];

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
                failure: roundId !== this.gameData.roundId + 1,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet, { gameRoundId: roundId }),
            },
            {
                failure:
                    this.gameData.remainingTime >= this.definition.durations.liveTime &&
                    this.gameData.remainingTime <= this.definition.durations.placingBets,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidEarlyBet),
            },
        ];
    }

    composeBetAmountValidationCriteria(player, amount, freeBet) {
        const settings = this.gameData.currencyGroupGames.find((x) => x.groupId.toString() === player.session.currencyGroupId);
        const configs = this.gameData.gameConfigs;
        const { earlyBet } = this.gameData.ingame[player.profile.name] || { earlyBet: {} };
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
                failure: Object.keys(earlyBet).length !== 0,
                notice: this.getNoticeObj(helpers.noticeHelper.cannotPlaceBet),
            },
        ];
    }

    adjustEarlyBet(playerName, bet) {
        const { amount, receivedTime } = bet;

        if (this.gameData.ingame?.[playerName]) {
            const playerInGame = this.gameData.ingame[playerName];

            playerInGame.earlyBet = {
                amount,
                time: receivedTime,
            };
        }
    }

    async updateEarlyBetRecord(player, earlyBet) {
        const { amount, receivedTime } = earlyBet;
        const roundId = this.gameData.roundId + 1;
        const operatorId = player.session?.operatorId;
        let existingEarlyBet = await this.earlyBetsRepository.findOne({ roundId, uid: player.UID, operatorId }).lean().exec();

        const action = {
            action: Actions.EarlyBet,
            amount,
            time: receivedTime,
        };

        if (existingEarlyBet) {
            existingEarlyBet.actions.push(action);
            await existingEarlyBet.save();
        } else {
            await this.earlyBetsRepository.create({
                roundId,
                uid: player.UID,
                name: player.profile.name,
                actions: [action],
                time: receivedTime,
                amount,
                operatorId,
            });
        }
    }
}

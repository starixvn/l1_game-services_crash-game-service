import { EventConsumers } from "sc-game-base/src/table";

export class InGameConsumer extends EventConsumers.TableInGameConsumer {
    constructor(definition, gameData, roundQuery, publisher, getBalance, userInfosRepository, provablyFairConsumer) {
        super(definition, gameData, roundQuery, publisher, getBalance, userInfosRepository);
        this.provablyFairConsumer = provablyFairConsumer;
    }

    async consume(realPlayer) {
        const payload = await this.buildPayload(realPlayer);
        const player = {
            id: realPlayer.UID,
            name: realPlayer.profile.name,
            red: payload.user.red,
            avatarId: payload.user.avatarId,
            type: payload.user.type,
        };

        if (!this.gameData.players[realPlayer.UID]) {
            this.gameData.players[realPlayer.UID] = player;
        }

        realPlayer.socketClient.emit(this.definition.name, payload);
        this.provablyFairConsumer.generateServerSeedAndPublishHash(realPlayer.UID, realPlayer.profile.name);
        this.publisher.publishToAllUsersExceptSystem(Systems.Mobi, realPlayer.UID, { player });
    }

    async buildPayload(realPlayer) {
        const { session } = realPlayer;

        const settings = this.gameData.currencyGroupGames.find((x) => x.groupId.toString() === session.currencyGroupId);

        const { odds, enableFreeBet, crashConfig } = this.gameData.gameConfigs;
        const gameConfigs = { ...settings, odds, enableFreeBet, maxWinPerRound: crashConfig.maxWinPerRound };
        const { betTracks } = this.gameData.ingame[realPlayer.profile.name] || { betTracks: {} };
        const betAmount = betTracks.roundId > 0 ? betTracks.amount : 0;
        const steps = betTracks.steps;

        const ownBets =
            betTracks.roundId > 0
                ? {
                      roundId: betTracks.roundId,
                      betAmount,
                      steps,
                  }
                : {};

        await this.getBalance(realPlayer, true);

        const user = await this.getUserInfo(realPlayer.UID);

        return {
            gameConfigs,
            ownBets,
            user,
        };
    }
}

import awilix from "awilix";
import { Core } from "sc-game-base";

import { PlaceBetConsumer, SettleGameRoundConsumer } from "./consumers";
import { Bets, Rounds, Results, BetLogs } from "./models";

const { asClass, asValue } = awilix;

export default class ContainerRegistry extends Core.ContainerRegistry {
    registerModels() {
        super.registerModels();

        this.container.register({
            roundsRepository: asValue(Rounds),
            betsRepository: asValue(Bets),
            roundsRepository: asValue(Results),
            betLogsRepository: asValue(BetLogs),
        });
    }

    registerConsumers() {
        super.registerConsumers();

        this.container.register({
            placeBetConsumer: asClass(PlaceBetConsumer).singleton(),
            settleGameRoundConsumer: asClass(SettleGameRoundConsumer).singleton().proxy(),
        });
    }
}

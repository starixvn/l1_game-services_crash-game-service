import awilix from "awilix";
import { Core } from "sc-game-base";
import { PlaceBetConsumer, SettleGameRoundConsumer, EarlyBetConsumer, CancelBetConsumer } from "./consumers";
import { Bets, Rounds, Results, BetLogs, EarlyBets } from "./models";

const { asClass, asValue } = awilix;

export default class ContainerRegistry extends Core.ContainerRegistry {
    registerModels() {
        super.registerModels();

        this.container.register({
            roundsRepository: asValue(Rounds),
            betsRepository: asValue(Bets),
            roundsRepository: asValue(Results),
            betLogsRepository: asValue(BetLogs),
            earlyBetsRepository: asValue(EarlyBets),
        });
    }

    registerConsumers() {
        super.registerConsumers();

        this.container.register({
            placeBetConsumer: asClass(PlaceBetConsumer).singleton(),
            settleGameRoundConsumer: asClass(SettleGameRoundConsumer).singleton().proxy(),
            earlyBetConsumer: asClass(EarlyBetConsumer).singleton(),
            cancelBetConsumer: asClass(CancelBetConsumer).singleton(),
        });
    }
}

import awilix from "awilix";
import { Core } from "sc-game-base";
import { PlaceBetConsumer, SettleGameRoundConsumer, EarlyBetConsumer, CancelBetConsumer } from "./consumers";
import { Bets, Rounds, Results, BetLogs, EarlyBets } from "./models";
import GameCrons from "./crons/game-crons";
import { LiveGameCrons } from "./crons";
import LiveGamePublisher from "./event-publishers/live-game-publisher";

const { asClass, asValue } = awilix;

export default class ContainerRegistry extends Core.ContainerRegistry {
    registerModels() {
        super.registerModels();

        this.container.register({
            roundsRepository: asValue(Rounds),
            betsRepository: asValue(Bets),
            resultsRepository: asValue(Results),
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

    registerPublishers() {
        super.registerPublishers();

        this.container.register({
            liveGamePublisher: asClass(LiveGamePublisher).singleton(),
        });
    }

    registerCrons() {
        super.registerCrons();

        this.container.register({
            gameCron: asClass(GameCrons).singleton().proxy(),
            liveGameCrons: asClass(LiveGameCrons).singleton().proxy(),
            //bot: asClass(Bot).singleton(),
            //processBetQueue: asClass(ProcessBetQueue).singleton().proxy(),
        });
    }
}

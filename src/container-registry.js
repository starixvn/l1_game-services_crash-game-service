import awilix from "awilix";
import { Table } from "sc-game-base";
import { CashOutConsumer, PlaceBetConsumer, SettleGameRoundConsumer } from "./consumers";
import { Bets, Rounds, Results, BetLogs } from "./models";
import GameCrons from "./crons/game-crons";
import { LiveGameCrons } from "./crons";
import RoundQuery from "./query-apis/round-query";
import { LiveGamePublisher, PlaceBetPublisher } from "./event-publishers";

const { asClass, asValue } = awilix;

export default class ContainerRegistry extends Table.TableContainerRegistry {
    registerModels() {
        super.registerModels();

        this.container.register({
            roundsRepository: asValue(Rounds),
            betsRepository: asValue(Bets),
            resultsRepository: asValue(Results),
            betLogsRepository: asValue(BetLogs),
        });
    }

    registerConsumers() {
        super.registerConsumers();

        this.container.register({
            placeBetConsumer: asClass(PlaceBetConsumer).singleton(),
            cashOutConsumer: asClass(CashOutConsumer).singleton(),
            settleGameRoundConsumer: asClass(SettleGameRoundConsumer).singleton().proxy(),
        });
    }

    registerPublishers() {
        super.registerPublishers();

        this.container.register({
            liveGamePublisher: asClass(LiveGamePublisher).singleton(),
            placeBetConsumer: asClass(PlaceBetPublisher).singleton(),
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

    registerApis() {
        super.registerApis();

        this.container.register({
            roundQuery: asClass(RoundQuery).singleton(),
        });
    }
}

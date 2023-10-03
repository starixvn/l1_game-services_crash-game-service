import awilix from "awilix";
import { Table } from "sc-game-base";
import { CashOutConsumer, InGameConsumer, PlaceBetConsumer, SettleGameRoundConsumer } from "./consumers";
import { Bets, Rounds, Results, BetLogs } from "./models";
import GameCrons from "./crons/game-crons";
import { LiveGameCrons } from "./crons";
import RoundQuery from "./query-apis/round-query";
import { LiveGamePublisher, PlaceBetPublisher } from "./event-publishers";
import ProcessBetQueue from "./crons/process-bet-queue";
import BaseSocketRouter from "./routers/base-socket-router";

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
            inGameConsumer: asClass(InGameConsumer).singleton(),
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
            processBetQueue: asClass(ProcessBetQueue).singleton().proxy(),
            //bot: asClass(Bot).singleton(),
        });
    }

    registerApis() {
        super.registerApis();

        this.container.register({
            roundQuery: asClass(RoundQuery).singleton(),
        });
    }

    registerRouters() {
        super.registerRouters();

        this.container.register({
            socketRouter: asClass(BaseSocketRouter).proxy(),
        });
    }
}

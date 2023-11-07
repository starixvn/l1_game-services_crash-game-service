import awilix from "awilix";
import { Table } from "sc-game-base";
import { CashOutConsumer, InGameConsumer, PlaceBetConsumer, SettleGameRoundConsumer } from "./consumers";
import RoundResultConsumer from "./consumers/round-result-consumer";
import { LiveGameCrons } from "./crons";
import Bot from "./crons/bot";
import GameCrons from "./crons/game-crons";
import ProcessBetQueue from "./crons/process-bet-queue";
import { LiveGamePublisher, PlaceBetPublisher } from "./event-publishers";
import { BetLogs, Bets, Results, Rounds, tempBetLogs, tempBets } from "./models";
import liveGameLogs from "./models/live-game-logs";
import { HistoryQuery, RoundQuery } from "./query-apis";
import { HttpRouter, SocketRouter } from "./routers";

const { asClass, asValue } = awilix;

export default class ContainerRegistry extends Table.TableContainerRegistry {
    registerModels() {
        const definition = this.container.resolve("definition");
        super.registerModels();

        this.container.register({
            roundsRepository: asValue(Rounds(definition.configName)),
            betsRepository: asValue(Bets(definition.configName)),
            resultsRepository: asValue(Results(definition.configName)),
            betLogsRepository: asValue(BetLogs(definition.configName)),
            tempBetsRepository: asValue(tempBets(definition.configName)),
            tempBetLogsRepository: asValue(tempBetLogs(definition.configName)),
            liveGameLogsRepository: asValue(liveGameLogs(definition.configName)),
        });
    }

    registerConsumers() {
        super.registerConsumers();

        this.container.register({
            inGameConsumer: asClass(InGameConsumer).singleton(),
            placeBetConsumer: asClass(PlaceBetConsumer).singleton(),
            cashOutConsumer: asClass(CashOutConsumer).singleton(),
            roundResultConsumer: asClass(RoundResultConsumer).singleton(),
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
            bot: asClass(Bot).singleton(),
        });
    }

    registerApis() {
        super.registerApis();

        this.container.register({
            roundQuery: asClass(RoundQuery).singleton(),
            historyQuery: asClass(HistoryQuery).singleton(),
        });
    }

    registerRouters() {
        super.registerRouters();

        this.container.register({
            socketRouter: asClass(SocketRouter).proxy(),
            httpRouter: asClass(HttpRouter),
        });
    }
}

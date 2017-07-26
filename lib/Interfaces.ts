export interface IAstAction {
    ActionID?: string;
    Action: string;
}

export interface IAmiClientOptions {
    addTime?: boolean;
    attemptsDelay?: number;
    emitEventsByTypes?: boolean;
    emitResponsesById?: boolean;
    eventFilter?: Set<string> ;
    eventFilterDef?: string[] | {};
    eventTypeToLowerCase?: boolean;
    keepAlive?: boolean;
    keepAliveDelay?: number;
    maxAttemptsCount?: number;
    reconnect?: boolean;
    undefinedOption?: any;
}

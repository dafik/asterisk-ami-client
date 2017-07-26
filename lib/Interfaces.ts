export interface IAmiMessage {
    ActionID?: string;
}

export interface IAmiAction extends IAmiMessage {
    Action: string;
}

export interface IAmiEvent extends IAmiMessage {
    Event: string;
}

export interface IAmiResponse extends IAmiMessage {
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

export interface IAmiConnectionOptions {
    port: number;
    host?: string;
    localAddress?: string;
    localPort?: string;
    family?: number;
    allowHalfOpen?: boolean;
}

export interface IDfiAMIResponse {
    Response: string; // Error, Follows
    ActionID: string;
    $time: number;
}

import AmiConnection from "dfi-asterisk-ami-connector/lib/AmiConnection";

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

export interface IAmiClient extends NodeJS.Events {
    readonly specPrefix: string;
    readonly lastEvent: IAmiEvent;
    readonly lastResponse: IDfiAMIResponse;
    readonly isConnected: boolean;
    readonly lastAction: IAmiAction;
    readonly connection: AmiConnection;

    (options?: IAmiClientOptions): IAmiClient;

    connect(user: string, secret: string, options: IAmiConnectionOptions): Promise<AmiConnection>;

    disconnect(): this;

    action(message: IAmiAction): this ;

    action(message: IAmiAction, promisable: false): this ;

    action(message: IAmiAction, promisable: true): Promise<IDfiAMIResponse>;

    write(message: IAmiAction): this ;

    write(message: IAmiAction, promisable: false): this ;

    write(message: IAmiAction, promisable?: true): Promise<IDfiAMIResponse>;

    send(message: IAmiAction): this ;

    send(message: IAmiAction, promisable: false): this ;

    send(message: IAmiAction, promisable: true): Promise<IDfiAMIResponse>;

    option(name: string, value?: any): any;

    options(): IAmiClientOptions ;

    options(newOptions: IAmiClientOptions): this ;
}

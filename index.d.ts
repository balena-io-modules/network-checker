declare module 'network-checker' {

	import * as Bluebird from 'bluebird';
	import * as net from 'net';

	export interface ConnectOptions extends net.TcpNetConnectOpts, net.IpcNetConnectOpts {
		interval: number;
		timeout: number;
	}

	export interface CheckOptions {
		timeout: number;
		gzip: boolean;
	}

	export type MonitorCheckFunction = (opt: ConnectOptions) => boolean | PromiseLike<boolean>;
	export type MonitorChangeFunction = (connected: boolean) => any;

	export function monitor(checkFn: MonitorCheckFunction, opts: ConnectOptions, fn: MonitorChangeFunction): void;
	export function monitorUrl(opts: ConnectOptions, fn: MonitorChangeFunction): void;
	export function checkUrl(optsOrUrl: CheckOptions | string): Bluebird<boolean>;
	export function checkHost(opts: ConnectOptions): Bluebird<boolean>;
	export function monitorHost(opts: ConnectOptions, fn: MonitorChangeFunction): void;
}

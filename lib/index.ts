import { connect } from 'net';
import { once } from 'events';
import type { TcpNetConnectOpts, IpcNetConnectOpts } from 'net';

interface BaseConnectOptions {
	interval?: number;
	timeout?: number;
}

type TcpConnectOptions = BaseConnectOptions & TcpNetConnectOpts;
type IpcConnectOptions = BaseConnectOptions & IpcNetConnectOpts;
export type ConnectOptions = TcpConnectOptions | IpcConnectOptions;

export interface CheckOptions {
	url: string;
	timeout?: number;
	gzip?: boolean;
}

export type MonitorCheckFunction = (
	opt: ConnectOptions | CheckOptions,
) => PromiseLike<boolean>;
export type MonitorChangeFunction = (connected: boolean) => any;

export function monitor(
	checkFn: MonitorCheckFunction,
	opts: ConnectOptions | (CheckOptions & { interval?: number }),
	fn: MonitorChangeFunction,
): void {
	if (typeof checkFn !== 'function') {
		throw new Error('checkFn should be a Function');
	}
	const interval = opts.interval ?? 0;
	// Used to prevent multiple messages when disconnected
	let connectivityState: boolean | null = null;
	async function check() {
		try {
			const connected = await checkFn(opts);
			if (connected !== connectivityState) {
				connectivityState = connected;
				// Do not wait on fn if it returns a promise
				fn(connected);
				return;
			}
		} finally {
			setTimeout(check, interval);
		}
	}
	void check();
}

export async function checkUrl(url: string): Promise<boolean>;
export async function checkUrl(options: CheckOptions): Promise<boolean>;
export async function checkUrl(input: string | CheckOptions): Promise<boolean> {
	let url: string;
	let timeout = 10000;
	let gzip = true;
	if (typeof input === 'string') {
		url = input;
	} else {
		url = input.url;
		timeout = input.timeout ?? timeout;
		gzip = input.gzip ?? gzip;
	}
	try {
		const result = await fetch(url, {
			method: 'GET',
			headers: {
				'Accept-Encoding': gzip ? 'gzip' : 'identity',
			},
			signal: AbortSignal.timeout(timeout),
		});
		return [200, 304].includes(result.status);
	} catch {
		return false;
	}
}

export function monitorUrl(
	opts: CheckOptions & { interval?: number },
	fn: MonitorChangeFunction,
): void {
	monitor(checkUrl, opts, fn);
}

export async function checkHost(opts: ConnectOptions): Promise<boolean> {
	const timeout = opts.timeout ?? 10000;
	const socket = connect(opts);
	socket.setTimeout(timeout, () => socket.destroy(new Error('Timed out')));
	try {
		await once(socket, 'connect');
		return true;
	} catch {
		return false;
	} finally {
		socket?.destroy();
	}
}

export function monitorHost(
	opts: ConnectOptions,
	fn: MonitorChangeFunction,
): void {
	monitor(checkHost, opts, fn);
}

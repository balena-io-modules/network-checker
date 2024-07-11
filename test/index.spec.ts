import { expect } from 'chai';
import type { Interceptable } from 'undici';
import { MockAgent, setGlobalDispatcher } from 'undici';
import * as net from 'net';
import * as fs from 'fs';
import { setTimeout } from 'timers/promises';
import * as netCheck from '../lib/index';

describe('network-check', () => {
	const HOST = 'https://balena.io';
	let mockAgent: MockAgent;
	let mockPool: Interceptable;
	before(() => {
		mockAgent = new MockAgent();
		setGlobalDispatcher(mockAgent);
	});

	describe('monitor', () => {
		beforeEach(() => {
			mockPool = mockAgent.get(HOST);
			mockPool
				.intercept({
					path: '/test1',
				})
				.reply(200)
				.persist();
		});

		afterEach(async () => {
			await mockPool.close();
		});

		it('throws an error if checkFn is not a function', () => {
			expect(() => {
				// @ts-expect-error intentionally testing that invalid args fail
				netCheck.monitor(null, { url: HOST }, () => {
					/* noop */
				});
			}).to.throw('checkFn should be a Function');
		});

		it('calls checkFn with opts at specified interval', async () => {
			let count = 0;
			const interval = 100;
			const opts = { url: `${HOST}/test1`, interval };
			const checkFn = () => {
				count++;
				return Promise.resolve(true);
			};

			netCheck.monitor(checkFn, opts, () => {
				/* noop */
			});

			await setTimeout(interval * 3);

			expect(count).to.be.greaterThan(1);
		});

		it('calls fn with connected state when checkFn returns a different state', async () => {
			const interval = 100;
			const opts = { url: `${HOST}/test1`, interval };
			const checkFn = () => {
				return Promise.resolve(true);
			};
			const fn = (connected: boolean) => {
				fnCallCount++;
				expect(connected).to.be.true;
			};
			let fnCallCount = 0;

			netCheck.monitor(checkFn, opts, fn);

			await setTimeout(interval * 3);

			// Connectivity state only changes once, so only one call to fn
			expect(fnCallCount).to.equal(1);
		});
	});

	describe('checkUrl', () => {
		beforeEach(() => {
			mockPool = mockAgent.get(HOST);
		});

		afterEach(async () => {
			await mockPool.close();
		});

		it('accepts either a url string or a CheckOptions object', async () => {
			mockPool
				.intercept({
					path: '/test',
				})
				.reply(200)
				.times(2);

			expect(await netCheck.checkUrl({ url: `${HOST}/test` })).to.be.true;

			expect(
				await netCheck.checkUrl({
					url: `${HOST}/test`,
					timeout: 2000,
					gzip: true,
				}),
			).to.be.true;
		});

		it('returns true if url check responds with 200', async () => {
			mockPool
				.intercept({
					path: '/test',
				})
				.reply(200);

			expect(await netCheck.checkUrl({ url: `${HOST}/test` })).to.be.true;
		});

		it('returns true if url check responds with 304', async () => {
			mockPool
				.intercept({
					path: '/test',
				})
				.reply(304);

			expect(await netCheck.checkUrl({ url: `${HOST}/test` })).to.be.true;
		});

		it('returns false if url check responds with any other status code', async () => {
			mockPool
				.intercept({
					path: '/test',
				})
				.reply(500);

			expect(await netCheck.checkUrl({ url: `${HOST}/test` })).to.be.false;

			mockPool
				.intercept({
					path: '/test',
				})
				.reply(400);

			expect(await netCheck.checkUrl({ url: `${HOST}/test` })).to.be.false;
		});

		it('returns false if url check times out', async () => {
			mockPool
				.intercept({
					path: '/test',
				})
				.reply(200)
				.delay(2000);

			// Should time out and return false
			expect(
				await netCheck.checkUrl({
					url: `${HOST}/test`,
					timeout: 200,
				}),
			).to.be.false;
		});

		it('returns false if url check throws an error', async () => {
			// Should throw an error from parsing malformed URL
			expect(await netCheck.checkUrl({ url: 'badurl' })).to.be.false;
		});

		it('makes request with gzip encoding if gzip option is true', async () => {
			mockPool
				.intercept({
					path: '/test',
					headers: {
						'Accept-Encoding': 'gzip',
					},
				})
				.reply(200);

			expect(
				await netCheck.checkUrl({
					url: `${HOST}/test`,
					gzip: true,
				}),
			).to.be.true;
		});

		it('makes request with identity encoding if gzip option is false', async () => {
			mockPool
				.intercept({
					path: '/test',
					headers: {
						'Accept-Encoding': 'identity',
					},
				})
				.reply(200);

			expect(
				await netCheck.checkUrl({
					url: `${HOST}/test`,
					gzip: false,
				}),
			).to.be.true;
		});
	});

	describe('checkHost', () => {
		const SOCKET = '/tmp/test.sock';
		let server: net.Server;

		interface CodedSysError extends Error {
			code?: string;
		}

		const isCodedSysError = (e: unknown): e is CodedSysError =>
			e != null && e instanceof Error && Object.hasOwn(e, 'code');

		const cleanupSocket = () => {
			try {
				fs.unlinkSync(SOCKET);
			} catch (e: unknown) {
				if (isCodedSysError(e) && e.code !== 'ENOENT') {
					throw e;
				}
			}
		};

		beforeEach(cleanupSocket);
		process.on('exit', cleanupSocket);

		it('returns true if connection succeeds', async () => {
			server = net.createServer();
			server.listen(SOCKET);

			expect(await netCheck.checkHost({ path: SOCKET })).to.be.true;

			server?.close();
		});

		it('returns false if connection fails', async () => {
			expect(await netCheck.checkHost({ path: SOCKET })).to.be.false;
		});
	});
});

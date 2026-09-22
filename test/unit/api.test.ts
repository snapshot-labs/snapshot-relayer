const mockCapture = jest.fn();
jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: (...args: any[]) => mockCapture(...args)
}));

jest.mock('../../src/db', () => ({ db: {} }));

const mockGetSafeVersion = jest.fn();
jest.mock('../../src/utils', () => ({
  getSafeVersion: (...args: any[]) => mockGetSafeVersion(...args)
}));

jest.mock('@snapshot-labs/snapshot.js', () => ({
  __esModule: true,
  default: { utils: { getHash: () => '0xmsghash' } }
}));

import express from 'express';
import request from 'supertest';
import router from '../../src/api';

const app = express().use(express.json()).use(router);

const body = {
  address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  data: { types: { Space: [] }, message: { timestamp: 1721600000 } }
};

const withCode = (code: unknown, props = {}) =>
  Object.assign(new Error(String(code)), { code, ...props });
const callException = (error?: unknown) =>
  withCode('CALL_EXCEPTION', { error });
const serverError = (props = {}) => withCode('SERVER_ERROR', props);

describe('POST / when getSafeVersion fails', () => {
  const notASafe: [string, Error][] = [
    ['EOA: eth_call returned 0x', callException()],
    [
      'contract reverted: JSON-RPC error 3',
      callException(
        serverError({ error: { code: 3, message: 'execution reverted' } })
      )
    ]
  ];

  it.each(notASafe)('returns 400 without capture on %s', async (_, err) => {
    mockGetSafeVersion.mockRejectedValueOnce(err);

    const response = await request(app).post('/').send(body);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: 'Invalid format request',
      details: [{ path: 'address', message: 'Not a Safe account' }]
    });
    expect(mockCapture).not.toHaveBeenCalled();
  });

  const transport: [string, Error][] = [
    ['HTTP 404 from the edge', callException(serverError({ status: 404 }))],
    ['timeout', callException(withCode('TIMEOUT'))],
    ['connection refused', callException(serverError())],
    ['non-JSON 200', callException(serverError({ error: serverError() }))],
    [
      'JSON-RPC internal error',
      callException(
        serverError({ error: { code: -32603, message: 'internal error' } })
      )
    ],
    ['non-RPC error', withCode('23505')]
  ];

  it.each(transport)('returns 500 and captures on %s', async (_, err) => {
    mockGetSafeVersion.mockRejectedValueOnce(err);

    const response = await request(app).post('/').send(body);

    expect(response.statusCode).toBe(500);
    expect(mockCapture).toHaveBeenCalledWith(err);
  });
});

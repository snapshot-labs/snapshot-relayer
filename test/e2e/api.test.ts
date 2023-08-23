import request from 'supertest';

const HOST = `http://localhost:${process.env.PORT || 3003}`;

describe('POST /', () => {
  describe('when the request body is invalid', () => {
    const inputs: [string, any][] = [
      ['empty', {}],
      ['missing the data key', { foo: 'bar' }],
      ['missing the data.msg key', { data: { foo: 'bar' } }]
    ];

    it.each(inputs)('returns a 400 error when the input is %s', async (name, input) => {
      const response = await request(HOST).post('/').send(input);

      expect(response.statusCode).toBe(400);
    });
  });
});

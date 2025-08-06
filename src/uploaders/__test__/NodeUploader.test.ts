import { uploadMultiple, uploadOne } from '../NodeUploader'
import request from '../../Request'
import { NetworkError, NetworkErrorCode } from '../../NetworkError'
import path from 'path'

jest.mock('../../Request')

const mockLogger = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  success: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  level: -1
}

test('uploadOne(): dispatches a request with the correct params', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  mockedRequest.mockResolvedValue()
  await uploadOne({
    apiKey: '123',
    sourceMap: 'bundle.js.map',
    bundle: 'bundle.js',
    appVersion: '1.2.3',
    projectRoot: path.join(__dirname, 'fixtures/a')
  })
  expect(mockedRequest).toHaveBeenCalledTimes(1)
  expect(mockedRequest).toHaveBeenCalledWith(
    'https://upload.bugsnag.com/sourcemap',
    expect.objectContaining({
      apiKey: '123',
      appVersion: '1.2.3',
      minifiedFile: expect.any(Object),
      minifiedUrl: 'bundle.js',
      overwrite: false,
      sourceMap: expect.any(Object)
    }),
    {},
    { idleTimeout: undefined }
  )
})

test('uploadOne(): dispatches a request with the correct params and detected appVersion', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  mockedRequest.mockResolvedValue()
  await uploadOne({
    apiKey: '123',
    sourceMap: 'build/static/js/2.e5bb21a6.chunk.js.map',
    bundle: 'build/static/js/2.e5bb21a6.chunk.js',
    detectAppVersion: true,
    projectRoot: path.join(__dirname, 'fixtures/c')
  })
  expect(mockedRequest).toHaveBeenCalledTimes(1)
  expect(mockedRequest).toHaveBeenCalledWith(
    'https://upload.bugsnag.com/sourcemap',
    expect.objectContaining({
      apiKey: '123',
      appVersion: '1.2.3',
      minifiedFile: expect.any(Object),
      minifiedUrl: 'build/static/js/2.e5bb21a6.chunk.js',
      overwrite: false,
      sourceMap: expect.any(Object)
    }),
    {},
    { idleTimeout: undefined }
  )
})

test('uploadOne(): fails when unable to detect appVersion', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  try {
    await uploadOne({
      apiKey: '123',
      projectRoot: path.join(__dirname, 'fixtures/h'),
      sourceMap: 'build/static/js/2.e5bb21a6.chunk.js.map',
      bundle: 'build/static/js/2.e5bb21a6.chunk.js',
      detectAppVersion: true,
      logger: mockLogger
    })
    expect(mockedRequest).not.toHaveBeenCalled()
  } catch (e) {
    expect(e).toBeTruthy()
    expect(e.message).toBe('Unable to automatically detect app version. Provide the "--app-version" argument or add a "version" key to your package.json file.')
    expect(mockLogger.error).toHaveBeenCalledWith('Unable to automatically detect app version. Provide the "--app-version" argument or add a "version" key to your package.json file.')
  }
})

test('uploadOne(): failure (unexpected network error)', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  const err = new NetworkError('misc upload error')
  err.cause = new Error('network error')
  mockedRequest.mockRejectedValue(err)
  try {
    await uploadOne({
      apiKey: '123',
      bundle: 'bundle.js',
      sourceMap: 'bundle.js.map',
      projectRoot: path.join(__dirname, 'fixtures/a'),
      logger: mockLogger
    })
    expect(mockedRequest).toHaveBeenCalledTimes(1)
  } catch (e) {
    expect(e).toBeTruthy()
    expect(e.message).toBe('misc upload error')
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('An unexpected error occurred.'), expect.any(Error), expect.any(Error))
  }
})

test('uploadOne(): failure (source map not found)', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  mockedRequest.mockRejectedValue(new Error('network error'))
  try {
    await uploadOne({
      apiKey: '123',
      bundle: 'bundle.js',
      sourceMap: 'not-found.js.map',
      projectRoot: path.join(__dirname, 'fixtures/a'),
      logger: mockLogger
    })
    expect(mockedRequest).toHaveBeenCalledTimes(1)
  } catch (e) {
    expect(e).toBeTruthy()
    expect(e.message).toMatch(/ENOENT/)
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('The source map "not-found.js.map" could not be found'))
  }
})


test('uploadOne(): failure (bundle not found)', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  mockedRequest.mockRejectedValue(new Error('network error'))
  try {
    await uploadOne({
      apiKey: '123',
      bundle: 'not-found.js',
      sourceMap: 'bundle.js.map',
      projectRoot: path.join(__dirname, 'fixtures/a'),
      logger: mockLogger
    })
    expect(mockedRequest).toHaveBeenCalledTimes(1)
  } catch (e) {
    expect(e).toBeTruthy()
    expect(e.message).toMatch(/ENOENT/)
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('The bundle "not-found.js" could not be found'))
  }
})

test('uploadOne(): failure (sourcemap is invalid json)', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  try {
    await uploadOne({
      apiKey: '123',
      bundle: 'bundle.js',
      sourceMap: 'invalid-source-map.js.map',
      projectRoot: path.join(__dirname, 'fixtures/b'),
      logger: mockLogger
    })
    expect(mockedRequest).toHaveBeenCalledTimes(0)
  } catch (e) {
    expect(e).toBeTruthy()
    expect(e.message).toBe('Unexpected token h in JSON at position 0')
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('The source map was not valid JSON.'))
  }
})

test('uploadOne(): custom endpoint (origin only)', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  mockedRequest.mockResolvedValue()
  await uploadOne({
    endpoint: 'https://bugsnag.my-company.com',
    apiKey: '123',
    sourceMap: 'bundle.js.map',
    bundle: 'bundle.js',
    projectRoot: path.join(__dirname, 'fixtures/a'),
    logger: mockLogger
  })
  expect(mockedRequest).toHaveBeenCalledTimes(1)
  expect(mockedRequest).toHaveBeenCalledWith(
    'https://bugsnag.my-company.com/sourcemap',
    expect.objectContaining({
      apiKey: '123',
      minifiedFile: expect.any(Object),
      overwrite: false,
      sourceMap: expect.any(Object)
    }),
    {},
    { idleTimeout: undefined }
  )
})

test('uploadOne(): custom endpoint (absolute)', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  mockedRequest.mockResolvedValue()
  await uploadOne({
    endpoint: 'https://bugsnag.my-company.com/source-map-custom',
    apiKey: '123',
    sourceMap: 'bundle.js.map',
    bundle: 'bundle.js',
    projectRoot: path.join(__dirname, 'fixtures/a'),
    logger: mockLogger
  })
  expect(mockedRequest).toHaveBeenCalledTimes(1)
  expect(mockedRequest).toHaveBeenCalledWith(
    'https://bugsnag.my-company.com/source-map-custom',
    expect.objectContaining({
      apiKey: '123',
      minifiedUrl: 'bundle.js',
      overwrite: false,
      sourceMap: expect.any(Object)
    }),
    {},
    { idleTimeout: undefined }
  )
})

test('uploadOne(): custom endpoint (invalid URL)', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  try {
    await uploadOne({
      endpoint: 'hljsdf',
      apiKey: '123',
      sourceMap: 'bundle.js.map',
      bundle: 'bundle.js',
      projectRoot: path.join(__dirname, 'fixtures/a'),
      logger: mockLogger
    })
    expect(mockedRequest).toHaveBeenCalledTimes(0)
  } catch (e) {
    expect(e).toBeTruthy()
    expect(e.message).toBe('Invalid URL: hljsdf')
    expect(mockLogger.error).toHaveBeenCalledWith(e)
  }
})

test('uploadOne(): codeBundleId', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  mockedRequest.mockResolvedValue()
  await uploadOne({
    apiKey: '123',
    sourceMap: 'bundle.js.map',
    bundle: 'bundle.js',
    projectRoot: path.join(__dirname, 'fixtures/a'),
    logger: mockLogger,
    codeBundleId: 'r0001'
  })
  expect(mockedRequest).toHaveBeenCalledTimes(1)
  expect(mockedRequest).toHaveBeenCalledWith(
    'https://upload.bugsnag.com/sourcemap',
    expect.objectContaining({
      apiKey: '123',
      minifiedFile: expect.any(Object),
      overwrite: false,
      sourceMap: expect.any(Object),
      codeBundleId: 'r0001'
    }),
    {},
    { idleTimeout: undefined }
  )
})

test('uploadMultiple(): success', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  mockedRequest.mockResolvedValue()
  await uploadMultiple({
    apiKey: '123',
    directory: 'dist',
    projectRoot: path.join(__dirname, 'fixtures/f'),
    logger: mockLogger,
    appVersion: '1.2.3'
  })
  expect(mockedRequest).toHaveBeenCalledTimes(3)
  expect(mockedRequest).toHaveBeenCalledWith(
    'https://upload.bugsnag.com/sourcemap',
    expect.objectContaining({
      apiKey: '123',
      minifiedFile: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/f/dist/a.js'),
        data: expect.any(String)
      }),
      sourceMap: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/f/dist/a.js.map'),
        data: expect.any(String)
      }),
      overwrite: false,
      minifiedUrl: 'dist/a.js',
      appVersion: '1.2.3'
    }),
    {},
    { idleTimeout: undefined }
  )
  expect(mockedRequest).toHaveBeenCalledWith(
    'https://upload.bugsnag.com/sourcemap',
    expect.objectContaining({
      apiKey: '123',
      minifiedFile: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/f/dist/b.js'),
        data: expect.any(String)
      }),
      sourceMap: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/f/dist/b.js.map'),
        data: expect.any(String)
      }),
      overwrite: false,
      minifiedUrl: 'dist/b.js',
      appVersion: '1.2.3'
    }),
    {},
    { idleTimeout: undefined }
  )
  expect(mockedRequest).toHaveBeenCalledWith(
    'https://upload.bugsnag.com/sourcemap',
    expect.objectContaining({
      apiKey: '123',
      minifiedFile: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/f/dist/index.js'),
        data: expect.any(String)
      }),
      sourceMap: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/f/dist/index.js.map'),
        data: expect.any(String)
      }),
      overwrite: false,
      minifiedUrl: 'dist/index.js',
      appVersion: '1.2.3'
    }),
    {},
    { idleTimeout: undefined }
  )
})

test('uploadMultiple(): success with detected appVersion', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  mockedRequest.mockResolvedValue()
  await uploadMultiple({
    apiKey: '123',
    directory: 'build/static/js',
    projectRoot: path.join(__dirname, 'fixtures/c'),
    logger: mockLogger,
    detectAppVersion: true
  })
  expect(mockedRequest).toHaveBeenCalledTimes(4)
  expect(mockedRequest).toHaveBeenCalledWith(
    'https://upload.bugsnag.com/sourcemap',
    expect.objectContaining({
      apiKey: '123',
      minifiedFile: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/c/build/static/js/2.e5bb21a6.chunk.js'),
        data: expect.any(String)
      }),
      sourceMap: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/c/build/static/js/2.e5bb21a6.chunk.js.map'),
        data: expect.any(String)
      }),
      overwrite: false,
      minifiedUrl: 'build/static/js/2.e5bb21a6.chunk.js',
      appVersion: '1.2.3'
    }),
    {},
    { idleTimeout: undefined }
  )
  expect(mockedRequest).toHaveBeenCalledWith(
    'https://upload.bugsnag.com/sourcemap',
    expect.objectContaining({
      apiKey: '123',
      minifiedFile: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/c/build/static/js/3.1b8b4fc7.chunk.js'),
        data: expect.any(String)
      }),
      sourceMap: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/c/build/static/js/3.1b8b4fc7.chunk.js.map'),
        data: expect.any(String)
      }),
      overwrite: false,
      minifiedUrl: 'build/static/js/3.1b8b4fc7.chunk.js',
      appVersion: '1.2.3'
    }),
    {},
    { idleTimeout: undefined }
  )
  expect(mockedRequest).toHaveBeenCalledWith(
    'https://upload.bugsnag.com/sourcemap',
    expect.objectContaining({
      apiKey: '123',
      minifiedFile: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/c/build/static/js/main.286ac573.chunk.js'),
        data: expect.any(String)
      }),
      sourceMap: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/c/build/static/js/main.286ac573.chunk.js.map'),
        data: expect.any(String)
      }),
      overwrite: false,
      minifiedUrl: 'build/static/js/main.286ac573.chunk.js',
      appVersion: '1.2.3'
    }),
    {},
    { idleTimeout: undefined }
  )
  expect(mockedRequest).toHaveBeenCalledWith(
    'https://upload.bugsnag.com/sourcemap',
    expect.objectContaining({
      apiKey: '123',
      minifiedFile: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/c/build/static/js/runtime-main.ad66c902.js'),
        data: expect.any(String)
      }),
      sourceMap: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/c/build/static/js/runtime-main.ad66c902.js.map'),
        data: expect.any(String)
      }),
      overwrite: false,
      minifiedUrl: 'build/static/js/runtime-main.ad66c902.js',
      appVersion: '1.2.3'
    }),
    {},
    { idleTimeout: undefined }
  )
})

test('uploadMultiple(): success with codeBundleId', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  mockedRequest.mockResolvedValue()
  await uploadMultiple({
    apiKey: '123',
    directory: 'build/static/js',
    projectRoot: path.join(__dirname, 'fixtures/c'),
    logger: mockLogger,
    codeBundleId: 'r00012'
  })
  expect(mockedRequest).toHaveBeenCalledTimes(4)
  expect(mockedRequest).toHaveBeenCalledWith(
    'https://upload.bugsnag.com/sourcemap',
    expect.objectContaining({ codeBundleId: 'r00012' }),
    {},
    { idleTimeout: undefined }
  )
  expect(mockedRequest).toHaveBeenCalledWith(
    'https://upload.bugsnag.com/sourcemap',
    expect.objectContaining({ codeBundleId: 'r00012' }),
    {},
    { idleTimeout: undefined }
  )
  expect(mockedRequest).toHaveBeenCalledWith(
    'https://upload.bugsnag.com/sourcemap',
    expect.objectContaining({ codeBundleId: 'r00012' }),
    {},
    { idleTimeout: undefined }
  )
  expect(mockedRequest).toHaveBeenCalledWith(
    'https://upload.bugsnag.com/sourcemap',
    expect.objectContaining({ codeBundleId: 'r00012' }),
    {},
    { idleTimeout: undefined }
  )
})

test('uploadMultiple(): success using absolute path for "directory"', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  mockedRequest.mockResolvedValue()
  await uploadMultiple({
    apiKey: '123',
    directory: path.join(__dirname, 'fixtures/f/dist'),
    projectRoot: path.join(__dirname, 'fixtures/f'),
    logger: mockLogger,
    appVersion: '1.2.3'
  })
  expect(mockedRequest).toHaveBeenCalledTimes(3)
  expect(mockedRequest).toHaveBeenCalledWith(
    'https://upload.bugsnag.com/sourcemap',
    expect.objectContaining({
      apiKey: '123',
      minifiedFile: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/f/dist/a.js'),
        data: expect.any(String)
      }),
      sourceMap: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/f/dist/a.js.map'),
        data: expect.any(String)
      }),
      overwrite: false,
      minifiedUrl: 'dist/a.js',
      appVersion: '1.2.3'
    }),
    {},
    { idleTimeout: undefined }
  )
  expect(mockedRequest).toHaveBeenCalledWith(
    'https://upload.bugsnag.com/sourcemap',
    expect.objectContaining({
      apiKey: '123',
      minifiedFile: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/f/dist/b.js'),
        data: expect.any(String)
      }),
      sourceMap: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/f/dist/b.js.map'),
        data: expect.any(String)
      }),
      overwrite: false,
      minifiedUrl: 'dist/b.js',
      appVersion: '1.2.3'
    }),
    {},
    { idleTimeout: undefined }
  )
  expect(mockedRequest).toHaveBeenCalledWith(
    'https://upload.bugsnag.com/sourcemap',
    expect.objectContaining({
      apiKey: '123',
      minifiedFile: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/f/dist/index.js'),
        data: expect.any(String)
      }),
      sourceMap: expect.objectContaining({
        filepath: path.join(__dirname, 'fixtures/f/dist/index.js.map'),
        data: expect.any(String)
      }),
      overwrite: false,
      minifiedUrl: 'dist/index.js',
      appVersion: '1.2.3'
    }),
    {},
    { idleTimeout: undefined }
  )
})

test('uploadMultiple(): no source maps', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  const err = new NetworkError('timeout')
  err.code = NetworkErrorCode.TIMEOUT
  mockedRequest.mockRejectedValue(err)
  await uploadMultiple({
    apiKey: '123',
    directory: '.',
    projectRoot: path.join(__dirname, 'fixtures/d'),
    logger: mockLogger
  })
  expect(mockLogger.warn).toHaveBeenCalledWith('No source maps found.')
})

test('uploadMultiple(): no bundles', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  mockedRequest.mockResolvedValue()
  await uploadMultiple({
    apiKey: '123',
    directory: 'dist',
    projectRoot: path.join(__dirname, 'fixtures/g'),
    logger: mockLogger
  })
  expect(mockedRequest).toHaveBeenCalledTimes(3)
  expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('could not be found'))
})

test('uploadMultiple(): invalid source map', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  try {
    await uploadMultiple({
      apiKey: '123',
      directory: '.',
      projectRoot: path.join(__dirname, 'fixtures/b'),
      logger: mockLogger
    })
    expect(mockedRequest).not.toHaveBeenCalled()
  } catch (e) {
    expect(e).toBeTruthy()
    expect(e.message).toBe('Unexpected token h in JSON at position 0')
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('The source map was not valid JSON.'))
  }
})

test('uploadMultiple(): fails when unable to detect appVersion', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  try {
    await uploadMultiple({
      apiKey: '123',
      directory: 'build',
      projectRoot: path.join(__dirname, 'fixtures/h'),
      detectAppVersion: true,
      logger: mockLogger
    })
    expect(mockedRequest).not.toHaveBeenCalled()
  } catch (e) {
    expect(e).toBeTruthy()
    expect(e.message).toBe('Unable to automatically detect app version. Provide the "--app-version" argument or add a "version" key to your package.json file.')
    expect(mockLogger.error).toHaveBeenCalledWith('Unable to automatically detect app version. Provide the "--app-version" argument or add a "version" key to your package.json file.')
  }
})

test('uploadMultiple(): failure (timeout)', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  const err = new NetworkError('timeout')
  err.code = NetworkErrorCode.TIMEOUT
  mockedRequest.mockRejectedValue(err)
  try {
    await uploadMultiple({
      apiKey: '123',
      directory: 'dist',
      projectRoot: path.join(__dirname, 'fixtures/f'),
      logger: mockLogger
    })
    expect(mockedRequest).toHaveBeenCalledTimes(3)
  } catch (e) {
    expect(e).toBeTruthy()
    expect((e as NetworkError).code).toBe(NetworkErrorCode.TIMEOUT)
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('The request timed out'), expect.any(Error))
  }
})

test('uploadMultiple(): failure (connection error)', async () => {
  const mockedRequest = request as jest.MockedFunction<typeof request>
  const err = new NetworkError('misc error')
  err.code = NetworkErrorCode.UNKNOWN
  err.cause = new Error('the cause')
  mockedRequest.mockRejectedValue(err)
  try {
    await uploadMultiple({
      apiKey: '123',
      directory: 'dist',
      projectRoot: path.join(__dirname, 'fixtures/f'),
      logger: mockLogger
    })
    expect(mockedRequest).toHaveBeenCalledTimes(6)
  } catch (e) {
    expect(e).toBeTruthy()
    expect((e as NetworkError).code).toBe(NetworkErrorCode.UNKNOWN)
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('An unexpected error occurred'), expect.any(Error), expect.any(Error))
  }
})

describe('input validation errors (when using as a JS library', () => {
  test.each([
    [ {}, 'apiKey is required and must be a string' ],
    [ { apiKey: 123 }, 'apiKey is required and must be a string' ],
    [ { apiKey: '123' }, 'sourceMap is required and must be a string' ],
    [ { apiKey: '123', sourceMap: 'm.map', appVersion: 1 }, 'appVersion must be a string' ],
    [ { apiKey: '123', sourceMap: 'm.map', logger: null }, 'logger must be an object' ],
    [ { apiKey: '123', sourceMap: 'm.map', overwrite: 'yes' }, 'overwrite must be true or false' ],
    [ { apiKey: '123', sourceMap: 'm.map', somethingDifferent: 'yes' }, 'Unrecognized option(s): somethingDifferent' ],
    [
      { apiKey: '123', sourceMap: 'm.map', somethingDifferent: 'yes', somethingElse: 'no' },
      'Unrecognized option(s): somethingDifferent, somethingElse'
    ],
  ])('uploadOne(): invalid input rejects with an error', (input, expectedError) => {
    // The following line is meant to be invalid, so convince the linter and the compiler we definitely want to do it
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    return expect(uploadOne(input)).rejects.toThrowError(expectedError)
  })
  test.each([
    [ {}, 'apiKey is required and must be a string' ],
    [ { apiKey: 123 }, 'apiKey is required and must be a string' ],
    [ { apiKey: '123' }, 'directory is required and must be a string' ],
    [ { apiKey: '123', directory: '.', appVersion: 1 }, 'appVersion must be a string' ],
    [ { apiKey: '123', directory: '.', somethingDifferent: 'yes' }, 'Unrecognized option(s): somethingDifferent' ],
    [
      { apiKey: '123', directory: '.', somethingDifferent: 'yes', somethingElse: 'no' },
      'Unrecognized option(s): somethingDifferent, somethingElse'
    ],
  ])('uploadMultiple(): invalid input rejects with an error', (input, expectedError) => {
    // The following line is meant to be invalid, so convince the linter and the compiler we definitely want to do it
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    return expect(uploadMultiple(input)).rejects.toThrowError(expectedError)
  })

  describe('concurrency control', () => {

    test('uploadMultiple(): respects concurrency limit', async () => {
      const mockedRequest = request as jest.MockedFunction<typeof request>
      let activeRequests = 0
      let maxConcurrentRequests = 0

      mockedRequest.mockImplementation(() => {
        activeRequests++
        maxConcurrentRequests = Math.max(maxConcurrentRequests, activeRequests)

        return new Promise((resolve) => {
          setTimeout(() => {
            activeRequests--
            resolve()
          }, 50) // Simulate async work
        })
      })

      await uploadMultiple({
        apiKey: '123',
        directory: 'dist',
        projectRoot: path.join(__dirname, 'fixtures/f'), // has 3 source maps
        concurrency: 2,
        logger: mockLogger
      })

      expect(maxConcurrentRequests).toBe(2)
      expect(mockedRequest).toHaveBeenCalledTimes(3)
    })

    test('uploadMultiple(): processes all items even with some failures', async () => {
      const mockedRequest = request as jest.MockedFunction<typeof request>
      let callCount = 0

      mockedRequest.mockImplementation(() => {
        callCount++
        if (callCount === 2) {
          // Fail the second request
          const err = new NetworkError('simulated error')
          return Promise.reject(err)
        }
        return Promise.resolve()
      })

      try {
        await uploadMultiple({
          apiKey: '123',
          directory: 'dist',
          projectRoot: path.join(__dirname, 'fixtures/f'), // has 3 source maps
          concurrency: 2,
          logger: mockLogger
        })
      } catch (e) {
        // Expected to fail
      }

      // Should have attempted all 3 uploads despite one failure
      expect(mockedRequest).toHaveBeenCalledTimes(3)
    })

    test('uploadMultiple(): handles concurrency higher than item count', async () => {
      const mockedRequest = request as jest.MockedFunction<typeof request>
      let activeRequests = 0
      let maxConcurrentRequests = 0

      mockedRequest.mockImplementation(() => {
        activeRequests++
        maxConcurrentRequests = Math.max(maxConcurrentRequests, activeRequests)

        return new Promise((resolve) => {
          setTimeout(() => {
            activeRequests--
            resolve()
          }, 50)
        })
      })

      await uploadMultiple({
        apiKey: '123',
        directory: 'dist',
        projectRoot: path.join(__dirname, 'fixtures/f'), // has 3 source maps
        concurrency: 10, // Higher than the 3 source maps
        logger: mockLogger
      })

      // Should never exceed the actual number of items (3)
      expect(maxConcurrentRequests).toBe(3)
      expect(mockedRequest).toHaveBeenCalledTimes(3)
    })

    test('uploadMultiple(): maintains constant concurrency utilization', async () => {
      const mockedRequest = request as jest.MockedFunction<typeof request>
      const requestTimes: number[] = []
      const completionTimes: number[] = []
      const startTime = Date.now()

      mockedRequest.mockImplementation(() => {
        requestTimes.push(Date.now() - startTime)

        return new Promise((resolve) => {
          setTimeout(() => {
            completionTimes.push(Date.now() - startTime)
            resolve()
          }, Math.random() * 100 + 50) // Random duration 50-150ms
        })
      })

      await uploadMultiple({
        apiKey: '123',
        directory: 'dist',
        projectRoot: path.join(__dirname, 'fixtures/g'), // Larger fixture with more files
        concurrency: 2,
        logger: mockLogger
      })

      // With proper concurrency pool, new requests should start as soon as slots become available
      // This means we should have overlapping request/completion patterns
      expect(mockedRequest).toHaveBeenCalledTimes(3)

      // The first 2 requests should start immediately (within a few ms)
      expect(requestTimes[0]).toBeLessThan(10)
      expect(requestTimes[1]).toBeLessThan(10)

      // The third request should start after one of the first two completes
      // It should not wait for both to complete (that would be batch behavior)
      const thirdRequestTime = requestTimes[2]
      const firstCompletionTime = Math.min(completionTimes[0], completionTimes[1])
      expect(thirdRequestTime).toBeGreaterThanOrEqual(firstCompletionTime - 10) // Allow some timing tolerance
    })

    test('uploadMultiple(): handles empty directory gracefully', async () => {
      const mockedRequest = request as jest.MockedFunction<typeof request>

      await uploadMultiple({
        apiKey: '123',
        directory: 'empty',
        projectRoot: path.join(__dirname, 'fixtures/a'), // Directory with no .map files
        concurrency: 5,
        logger: mockLogger
      })

      expect(mockedRequest).not.toHaveBeenCalled()
      expect(mockLogger.warn).toHaveBeenCalledWith('No source maps found.')
    })

    test('uploadMultiple(): concurrency limit 1 processes files sequentially', async () => {
      const mockedRequest = request as jest.MockedFunction<typeof request>
      let activeRequests = 0
      let maxConcurrentRequests = 0
      const requestOrder: number[] = []
      const completionOrder: number[] = []
      let requestCounter = 0

      mockedRequest.mockImplementation(() => {
        const currentRequestId = ++requestCounter
        requestOrder.push(currentRequestId)
        activeRequests++
        maxConcurrentRequests = Math.max(maxConcurrentRequests, activeRequests)

        return new Promise((resolve) => {
          // Simulate async work with different durations to ensure order matters
          const delay = currentRequestId === 1 ? 100 : 50
          setTimeout(() => {
            activeRequests--
            completionOrder.push(currentRequestId)
            resolve()
          }, delay)
        })
      })

      await uploadMultiple({
        apiKey: '123',
        directory: 'dist',
        projectRoot: path.join(__dirname, 'fixtures/f'), // has 3 source maps
        concurrency: 1,
        logger: mockLogger
      })

      // With concurrency 1, should never have more than 1 active request
      expect(maxConcurrentRequests).toBe(1)
      expect(mockedRequest).toHaveBeenCalledTimes(3)

      // Requests should start in order: 1, 2, 3
      expect(requestOrder).toEqual([ 1, 2, 3 ])

      // With concurrency 1, completions should be strictly sequential
      // First request takes 100ms, others take 50ms, but they can't overlap
      expect(completionOrder).toEqual([ 1, 2, 3 ])
    })

    test('uploadMultiple(): fails fast on unrecoverable errors (INVALID_API_KEY)', async () => {
      const mockedRequest = request as jest.MockedFunction<typeof request>
      let callCount = 0
      
      mockedRequest.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // First request fails with INVALID_API_KEY (unrecoverable)
          const err = new NetworkError('Invalid API key')
          err.code = NetworkErrorCode.INVALID_API_KEY
          return Promise.reject(err)
        }
        // Other requests should never be called due to fail-fast
        return Promise.resolve()
      })

      try {
        await uploadMultiple({
          apiKey: 'invalid-key',
          directory: 'dist',
          projectRoot: path.join(__dirname, 'fixtures/f'), // has 3 source maps
          concurrency: 5,
          logger: mockLogger
        })
        // Should not reach here
        expect(false).toBe(true)
      } catch (e) {
        expect(e).toBeTruthy()
        expect((e as NetworkError).code).toBe(NetworkErrorCode.INVALID_API_KEY)
        
        // Should stop immediately after first failure, not process remaining files
        expect(callCount).toBe(1) // Only first request attempted
      }
    })

    test('uploadMultiple(): fails fast on unrecoverable errors (invalid endpoint)', async () => {
      const mockedRequest = request as jest.MockedFunction<typeof request>
      
      try {
        await uploadMultiple({
          apiKey: '123',
          directory: 'dist',
          projectRoot: path.join(__dirname, 'fixtures/f'),
          endpoint: 'invalid-url-format', // Invalid URL causes unrecoverable error
          concurrency: 5,
          logger: mockLogger
        })
        // Should not reach here
        expect(false).toBe(true)
      } catch (e) {
        expect(e).toBeTruthy()
        expect(e.message).toContain('Invalid URL')
        
        // Should fail before any requests are made due to invalid endpoint
        expect(mockedRequest).not.toHaveBeenCalled()
      }
    })

  })
})

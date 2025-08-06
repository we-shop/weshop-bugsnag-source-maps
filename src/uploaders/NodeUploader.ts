import path from 'path'
import http from 'http'
import glob from 'glob'

import { Logger, noopLogger } from '../Logger'
import File from '../File'
import request, { PayloadType } from '../Request'
import formatErrorLog from './lib/FormatErrorLog'
import applyTransformations from './lib/ApplyTransformations'
import readBundleContent from './lib/ReadBundleContent'
import readSourceMap from './lib/ReadSourceMap'
import parseSourceMap from './lib/ParseSourceMap'
import _detectAppVersion from './lib/DetectAppVersion'
import {
  validateBooleans,
  validateNoUnknownArgs,
  validateObjects,
  validateOptionalStrings,
  validateRequiredStrings
} from './lib/InputValidators'

import { buildEndpointUrl, DEFAULT_UPLOAD_ORIGIN } from './lib/EndpointUrl'
import { NetworkError, NetworkErrorCode } from '../NetworkError'

const UPLOAD_PATH = '/sourcemap'

function isUnrecoverableError (error: Error): boolean {
  // App version detection failures - affects all uploads
  if (error.message.includes('Unable to automatically detect app version')) {
    return true
  }

  // Network errors that affect all uploads
  if (error instanceof NetworkError) {
    switch (error.code) {
      case NetworkErrorCode.INVALID_API_KEY:
        return true // Wrong API key affects all uploads
      default:
        return false
    }
  }

  // Configuration errors that affect the entire upload session
  return error.message.includes('Invalid URL:');
}

async function uploadSingleFile (
  sourceMap: string,
  absoluteSearchPath: string,
  url: string,
  options: {
    apiKey: string
    appVersion?: string
    codeBundleId?: string
    overwrite: boolean
    projectRoot: string
    requestOpts: http.RequestOptions
    idleTimeout?: number
    logger: Logger
  }
): Promise<{ sourceMap: string, success: boolean, error?: Error }> {
  const { apiKey, appVersion, codeBundleId, overwrite, projectRoot, requestOpts, idleTimeout, logger } = options

  try {
    const [ sourceMapContent, fullSourceMapPath ] = await readSourceMap(sourceMap, absoluteSearchPath, logger)
    const sourceMapJson = parseSourceMap(sourceMapContent, fullSourceMapPath, logger)

    const bundlePath = sourceMap.replace(/\.map$/, '')
    let bundleContent, fullBundlePath
    try {
      [ bundleContent, fullBundlePath ] = await readBundleContent(bundlePath, absoluteSearchPath, sourceMap, logger)
    } catch (e) {
      // ignore error – it's already logged out
    }

    const transformedSourceMap = await applyTransformations(fullSourceMapPath, sourceMapJson, projectRoot, logger)

    const start = new Date().getTime()
    await request(url, {
      type: PayloadType.Node,
      apiKey,
      appVersion,
      codeBundleId,
      minifiedUrl: path.relative(projectRoot, path.resolve(absoluteSearchPath, bundlePath)).replace(/\\/g, '/'),
      minifiedFile: (bundleContent && fullBundlePath) ? new File(fullBundlePath, bundleContent) : undefined,
      sourceMap: new File(fullSourceMapPath, JSON.stringify(transformedSourceMap)),
      overwrite: overwrite
    }, requestOpts, { idleTimeout })

    const uploadedFiles = (bundleContent && fullBundlePath) ? `${sourceMap} and ${bundlePath}` : sourceMap
    logger.success(`Success, uploaded ${uploadedFiles} to ${url} in ${(new Date()).getTime() - start}ms`)

    return { sourceMap, success: true }
  } catch (error) {
    if (error.cause) {
      logger.error(formatErrorLog(error), error, error.cause)
    } else {
      logger.error(formatErrorLog(error), error)
    }
    return { sourceMap, success: false, error }
  }
}

async function processWithConcurrencyPool<T, R> (
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  return new Promise((resolve, reject) => {
    const results: R[] = []
    let currentIndex = 0
    let activeCount = 0
    let completedCount = 0
    let shouldStop = false

    function processNext (): void {
      // Fill up the concurrency pool
      while (activeCount < concurrency && currentIndex < items.length && !shouldStop) {
        const itemIndex = currentIndex
        currentIndex++
        activeCount++

        processor(items[itemIndex])
          .then((result) => {
            results[itemIndex] = result
            
            // Check for unrecoverable errors in results
            const uploadResult = result as { success?: boolean; error?: Error }
            if (!uploadResult?.success && uploadResult?.error && isUnrecoverableError(uploadResult.error)) {
              shouldStop = true
              // Reject immediately with the unrecoverable error
              reject(uploadResult.error)
              return
            }
          })
          .catch((error) => {
            // For failed uploads, we still want to store the error result
            // The processor should handle errors and return success/failure info
            results[itemIndex] = error
          })
          .finally(() => {
            activeCount--
            completedCount++

            // Check if we're done
            if (completedCount >= items.length) {
              resolve(results)
            } else if (!shouldStop) {
              // Process more items
              processNext()
            }
          })
      }
    }

    // Handle empty array case
    if (items.length === 0) {
      resolve(results)
      return
    }

    // Start processing
    processNext()
  })
}

interface UploadSingleOpts {
  apiKey: string
  sourceMap: string
  bundle: string
  appVersion?: string
  codeBundleId?: string
  overwrite?: boolean
  projectRoot?: string
  endpoint?: string
  detectAppVersion?: boolean
  requestOpts?: http.RequestOptions
  logger?: Logger
  idleTimeout?: number
}

function validateOneOpts (opts: Record<string, unknown>, unknownArgs: Record<string, unknown>) {
  validateRequiredStrings(opts, [ 'apiKey', 'sourceMap', 'projectRoot', 'endpoint' ])
  validateOptionalStrings(opts, [ 'bundle', 'appVersion', 'codeBundleId' ])
  validateBooleans(opts, [ 'overwrite', 'detectAppVersion' ])
  validateObjects(opts, [ 'requestOpts', 'logger' ])
  validateNoUnknownArgs(unknownArgs)
}

export async function uploadOne ({
  apiKey,
  bundle,
  sourceMap,
  appVersion,
  codeBundleId,
  idleTimeout,
  overwrite = false,
  projectRoot = process.cwd(),
  endpoint = DEFAULT_UPLOAD_ORIGIN,
  detectAppVersion = false,
  requestOpts = {},
  logger = noopLogger,
  ...unknownArgs
}: UploadSingleOpts): Promise<void> {
  validateOneOpts({
    apiKey,
    bundle,
    sourceMap,
    appVersion,
    codeBundleId,
    overwrite,
    projectRoot,
    endpoint,
    detectAppVersion,
    requestOpts,
    logger
  }, unknownArgs as Record<string, unknown>)

  logger.info(`Preparing upload of node source map for "${bundle}"`)

  let url
  try {
    url = buildEndpointUrl(endpoint, UPLOAD_PATH)
  } catch (e) {
    logger.error(e)
    throw e
  }

  const [ sourceMapContent, fullSourceMapPath ] = await readSourceMap(sourceMap, projectRoot, logger)
  const [ bundleContent, fullBundlePath ] = await readBundleContent(bundle, projectRoot, sourceMap, logger)

  const sourceMapJson = parseSourceMap(sourceMapContent, sourceMap, logger)
  const transformedSourceMap = await applyTransformations(fullSourceMapPath, sourceMapJson, projectRoot, logger)

  if (detectAppVersion) {
    try {
      appVersion = await _detectAppVersion(projectRoot, logger)
    } catch (e) {
      logger.error(e.message)

      throw e
    }
  }

  logger.debug(`Initiating upload to "${url}"`)
  const start = new Date().getTime()
  try {
    await request(url, {
      type: PayloadType.Node,
      apiKey,
      appVersion,
      codeBundleId,
      minifiedUrl: bundle.replace(/\\/g, '/'),
      minifiedFile: new File(fullBundlePath, bundleContent),
      sourceMap: new File(fullSourceMapPath, JSON.stringify(transformedSourceMap)),
      overwrite: overwrite
    }, requestOpts, { idleTimeout })
    logger.success(`Success, uploaded ${sourceMap} and ${bundle} to ${url} in ${(new Date()).getTime() - start}ms`)
  } catch (e) {
    if (e.cause) {
      logger.error(formatErrorLog(e), e, e.cause)
    } else {
      logger.error(formatErrorLog(e), e)
    }
    throw e
  }
}

interface UploadMultipleOpts {
  apiKey: string
  directory: string
  appVersion?: string
  codeBundleId?: string
  overwrite?: boolean
  projectRoot?: string
  endpoint?: string
  detectAppVersion?: boolean
  requestOpts?: http.RequestOptions
  logger?: Logger
  idleTimeout?: number
  concurrency?: number
}

function validateMultipleOpts (opts: Record<string, unknown>, unknownArgs: Record<string, unknown>) {
  validateRequiredStrings(opts, [ 'apiKey', 'directory', 'projectRoot', 'endpoint' ])
  validateOptionalStrings(opts, [ 'appVersion', 'codeBundleId' ])
  validateBooleans(opts, [ 'overwrite', 'detectAppVersion' ])
  validateObjects(opts, [ 'requestOpts', 'logger' ])
  validateNoUnknownArgs(unknownArgs)
}

export async function uploadMultiple ({
  apiKey,
  directory,
  appVersion,
  codeBundleId,
  idleTimeout,
  overwrite = false,
  projectRoot = process.cwd(),
  endpoint = DEFAULT_UPLOAD_ORIGIN,
  detectAppVersion = false,
  requestOpts = {},
  logger = noopLogger,
  concurrency = 5,
  ...unknownArgs
}: UploadMultipleOpts): Promise<void> {
  validateMultipleOpts({
    apiKey,
    directory,
    appVersion,
    codeBundleId,
    overwrite,
    projectRoot,
    endpoint,
    detectAppVersion,
    requestOpts,
    logger
  }, unknownArgs as Record<string, unknown>)

  logger.info(`Preparing upload of node source maps for "${directory}" (concurrency: ${concurrency})`)

  let url: string
  try {
    url = buildEndpointUrl(endpoint, UPLOAD_PATH)
  } catch (e) {
    logger.error(e)
    throw e
  }

  logger.debug(`Searching for source maps "${directory}"`)
  const absoluteSearchPath = path.resolve(projectRoot, directory)
  const sourceMaps: string[] = await new Promise((resolve, reject) => {
    glob('**/*.map', { ignore: '**/node_modules/**', cwd: absoluteSearchPath }, (err, files) => {
      if (err) return reject(err)
      resolve(files)
    })
  })

  if (sourceMaps.length === 0) {
    logger.warn('No source maps found.')
    return
  }

  logger.debug(`Found ${sourceMaps.length} source map(s):`)
  logger.debug(`  ${sourceMaps.join(', ')}`)

  if (detectAppVersion) {
    try {
      appVersion = await _detectAppVersion(projectRoot, logger)
    } catch (e) {
      logger.error(e.message)
      throw e
    }
  }

  const uploadOptions = {
    apiKey,
    appVersion,
    codeBundleId,
    overwrite,
    projectRoot,
    requestOpts,
    idleTimeout,
    logger
  }

  logger.info(`Starting parallel upload of ${sourceMaps.length} source map(s)`)
  const startTime = new Date().getTime()

  const results = await processWithConcurrencyPool(
    sourceMaps,
    (sourceMap) => uploadSingleFile(sourceMap, absoluteSearchPath, url, uploadOptions),
    concurrency
  )

  const successful = results.filter(r => r.success)
  const failed = results.filter(r => !r.success)

  const totalTime = new Date().getTime() - startTime
  logger.info(`Upload completed in ${totalTime}ms. Success: ${successful.length}, Failed: ${failed.length}`)

  if (failed.length > 0) {
    logger.error(`Failed to upload ${failed.length} source map(s):`)
    for (const result of failed) {
      logger.error(`  - ${result.sourceMap}: ${result.error?.message ?? 'Unknown error'}`)
    }

    // With fail-fast logic, we only reach here for recoverable errors
    // Preserve backward compatibility: throw original error for single file or uniform failures
    if (sourceMaps.length === 1 || failed.length === sourceMaps.length) {
      throw failed[0].error
    }

    throw new Error(`Failed to upload ${failed.length} of ${sourceMaps.length} source maps`)
  }
}

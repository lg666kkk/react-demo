/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *      
 */

                                                
                                                       

             
                  
                          
              
                
                                   

                                                                        

                                                                 

import {
  resolveClientReference,
  preloadModule,
  requireModule,
  dispatchHint,
  readPartialStringChunk,
  readFinalStringChunk,
  supportsBinaryStreams,
  createStringDecoder,
} from './ReactFlightClientConfig';

import {
  encodeFormAction,
  knownServerReferences,
} from './ReactFlightReplyClient';

import {REACT_LAZY_TYPE, REACT_ELEMENT_TYPE} from 'shared/ReactSymbols';

import {getOrCreateServerContext} from 'shared/ReactServerContextRegistry';

                                 

                                 

                       
          
        
           
          
                               
                              

const PENDING = 'pending';
const BLOCKED = 'blocked';
const RESOLVED_MODEL = 'resolved_model';
const RESOLVED_MODULE = 'resolved_module';
const INITIALIZED = 'fulfilled';
const ERRORED = 'rejected';

                        
                    
                                    
                                         
                      
                                                              
  
                        
                    
                                    
                                         
                      
                                                              
  
                              
                           
                            
               
                      
                                                              
  
                               
                            
                            
               
                      
                                                              
  
                            
                      
           
               
                      
                                                              
  
                        
                     
              
                
                      
                                                              
  
                   
                   
                   
                         
                          
                       
                    

// $FlowFixMe[missing-this-annot]
function Chunk(status     , value     , reason     , response          ) {
  this.status = status;
  this.value = value;
  this.reason = reason;
  this._response = response;
}
// We subclass Promise.prototype so that we get other methods like .catch
Chunk.prototype = (Object.create(Promise.prototype)     );
// TODO: This doesn't return a new Promise chain unlike the real .then
Chunk.prototype.then = function    (
                     
  resolve                     ,
  reject                          ,
) {
  const chunk               = this;
  // If we have resolved content, we try to initialize it first which
  // might put us back into one of the other states.
  switch (chunk.status) {
    case RESOLVED_MODEL:
      initializeModelChunk(chunk);
      break;
    case RESOLVED_MODULE:
      initializeModuleChunk(chunk);
      break;
  }
  // The status might have changed after initialization.
  switch (chunk.status) {
    case INITIALIZED:
      resolve(chunk.value);
      break;
    case PENDING:
    case BLOCKED:
      if (resolve) {
        if (chunk.value === null) {
          chunk.value = ([]                     );
        }
        chunk.value.push(resolve);
      }
      if (reject) {
        if (chunk.reason === null) {
          chunk.reason = ([]                         );
        }
        chunk.reason.push(reject);
      }
      break;
    default:
      reject(chunk.reason);
      break;
  }
};

                        
                              
                                  
                                       
                      
                                                    
                                
  

function readChunk   (chunk              )    {
  // If we have resolved content, we try to initialize it first which
  // might put us back into one of the other states.
  switch (chunk.status) {
    case RESOLVED_MODEL:
      initializeModelChunk(chunk);
      break;
    case RESOLVED_MODULE:
      initializeModuleChunk(chunk);
      break;
  }
  // The status might have changed after initialization.
  switch (chunk.status) {
    case INITIALIZED:
      return chunk.value;
    case PENDING:
    case BLOCKED:
      // eslint-disable-next-line no-throw-literal
      throw ((chunk     )             );
    default:
      throw chunk.reason;
  }
}

export function getRoot   (response          )              {
  const chunk = getChunk(response, 0);
  return (chunk     );
}

function createPendingChunk   (response          )                  {
  // $FlowFixMe[invalid-constructor] Flow doesn't support functions as constructors
  return new Chunk(PENDING, null, null, response);
}

function createBlockedChunk   (response          )                  {
  // $FlowFixMe[invalid-constructor] Flow doesn't support functions as constructors
  return new Chunk(BLOCKED, null, null, response);
}

function createErrorChunk   (
  response          ,
  error                 ,
)                  {
  // $FlowFixMe[invalid-constructor] Flow doesn't support functions as constructors
  return new Chunk(ERRORED, null, error, response);
}

function wakeChunk   (listeners                     , value   )       {
  for (let i = 0; i < listeners.length; i++) {
    const listener = listeners[i];
    listener(value);
  }
}

function wakeChunkIfInitialized   (
  chunk              ,
  resolveListeners                     ,
  rejectListeners                                ,
)       {
  switch (chunk.status) {
    case INITIALIZED:
      wakeChunk(resolveListeners, chunk.value);
      break;
    case PENDING:
    case BLOCKED:
      chunk.value = resolveListeners;
      chunk.reason = rejectListeners;
      break;
    case ERRORED:
      if (rejectListeners) {
        wakeChunk(rejectListeners, chunk.reason);
      }
      break;
  }
}

function triggerErrorOnChunk   (chunk              , error       )       {
  if (chunk.status !== PENDING && chunk.status !== BLOCKED) {
    // We already resolved. We didn't expect to see this.
    return;
  }
  const listeners = chunk.reason;
  const erroredChunk                  = (chunk     );
  erroredChunk.status = ERRORED;
  erroredChunk.reason = error;
  if (listeners !== null) {
    wakeChunk(listeners, error);
  }
}

function createResolvedModelChunk   (
  response          ,
  value                    ,
)                        {
  // $FlowFixMe[invalid-constructor] Flow doesn't support functions as constructors
  return new Chunk(RESOLVED_MODEL, value, null, response);
}

function createResolvedModuleChunk   (
  response          ,
  value                    ,
)                         {
  // $FlowFixMe[invalid-constructor] Flow doesn't support functions as constructors
  return new Chunk(RESOLVED_MODULE, value, null, response);
}

function resolveModelChunk   (
  chunk              ,
  value                    ,
)       {
  if (chunk.status !== PENDING) {
    // We already resolved. We didn't expect to see this.
    return;
  }
  const resolveListeners = chunk.value;
  const rejectListeners = chunk.reason;
  const resolvedChunk                        = (chunk     );
  resolvedChunk.status = RESOLVED_MODEL;
  resolvedChunk.value = value;
  if (resolveListeners !== null) {
    // This is unfortunate that we're reading this eagerly if
    // we already have listeners attached since they might no
    // longer be rendered or might not be the highest pri.
    initializeModelChunk(resolvedChunk);
    // The status might have changed after initialization.
    wakeChunkIfInitialized(chunk, resolveListeners, rejectListeners);
  }
}

function resolveModuleChunk   (
  chunk              ,
  value                    ,
)       {
  if (chunk.status !== PENDING && chunk.status !== BLOCKED) {
    // We already resolved. We didn't expect to see this.
    return;
  }
  const resolveListeners = chunk.value;
  const rejectListeners = chunk.reason;
  const resolvedChunk                         = (chunk     );
  resolvedChunk.status = RESOLVED_MODULE;
  resolvedChunk.value = value;
  if (resolveListeners !== null) {
    initializeModuleChunk(resolvedChunk);
    wakeChunkIfInitialized(chunk, resolveListeners, rejectListeners);
  }
}

let initializingChunk                          = (null     );
let initializingChunkBlockedModel                                    = null;
function initializeModelChunk   (chunk                       )       {
  const prevChunk = initializingChunk;
  const prevBlocked = initializingChunkBlockedModel;
  initializingChunk = chunk;
  initializingChunkBlockedModel = null;
  try {
    const value    = parseModel(chunk._response, chunk.value);
    if (
      initializingChunkBlockedModel !== null &&
      initializingChunkBlockedModel.deps > 0
    ) {
      initializingChunkBlockedModel.value = value;
      // We discovered new dependencies on modules that are not yet resolved.
      // We have to go the BLOCKED state until they're resolved.
      const blockedChunk                  = (chunk     );
      blockedChunk.status = BLOCKED;
      blockedChunk.value = null;
      blockedChunk.reason = null;
    } else {
      const initializedChunk                      = (chunk     );
      initializedChunk.status = INITIALIZED;
      initializedChunk.value = value;
    }
  } catch (error) {
    const erroredChunk                  = (chunk     );
    erroredChunk.status = ERRORED;
    erroredChunk.reason = error;
  } finally {
    initializingChunk = prevChunk;
    initializingChunkBlockedModel = prevBlocked;
  }
}

function initializeModuleChunk   (chunk                        )       {
  try {
    const value    = requireModule(chunk.value);
    const initializedChunk                      = (chunk     );
    initializedChunk.status = INITIALIZED;
    initializedChunk.value = value;
  } catch (error) {
    const erroredChunk                  = (chunk     );
    erroredChunk.status = ERRORED;
    erroredChunk.reason = error;
  }
}

// Report that any missing chunks in the model is now going to throw this
// error upon read. Also notify any pending promises.
export function reportGlobalError(response          , error       )       {
  response._chunks.forEach(chunk => {
    // If this chunk was already resolved or errored, it won't
    // trigger an error but if it wasn't then we need to
    // because we won't be getting any new data to resolve it.
    if (chunk.status === PENDING) {
      triggerErrorOnChunk(chunk, error);
    }
  });
}

function createElement(
  type       ,
  key       ,
  props       ,
)                     {
  const element      = {
    // This tag allows us to uniquely identify this as a React Element
    $$typeof: REACT_ELEMENT_TYPE,

    // Built-in properties that belong on the element
    type: type,
    key: key,
    ref: null,
    props: props,

    // Record the component responsible for creating this element.
    _owner: null,
  };
  if (__DEV__) {
    // We don't really need to add any of these but keeping them for good measure.
    // Unfortunately, _store is enumerable in jest matchers so for equality to
    // work, I need to keep it or make _store non-enumerable in the other file.
    element._store = ({}   
                          
     );
    Object.defineProperty(element._store, 'validated', {
      configurable: false,
      enumerable: false,
      writable: true,
      value: true, // This element has already been validated on the server.
    });
    Object.defineProperty(element, '_self', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: null,
    });
    Object.defineProperty(element, '_source', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: null,
    });
  }
  return element;
}

function createLazyChunkWrapper   (
  chunk              ,
)                                 {
  const lazyType                                 = {
    $$typeof: REACT_LAZY_TYPE,
    _payload: chunk,
    _init: readChunk,
  };
  return lazyType;
}

function getChunk(response          , id        )                 {
  const chunks = response._chunks;
  let chunk = chunks.get(id);
  if (!chunk) {
    chunk = createPendingChunk(response);
    chunks.set(id, chunk);
  }
  return chunk;
}

function createModelResolver   (
  chunk              ,
  parentObject        ,
  key        ,
)                       {
  let blocked;
  if (initializingChunkBlockedModel) {
    blocked = initializingChunkBlockedModel;
    blocked.deps++;
  } else {
    blocked = initializingChunkBlockedModel = {
      deps: 1,
      value: null,
    };
  }
  return value => {
    parentObject[key] = value;
    blocked.deps--;
    if (blocked.deps === 0) {
      if (chunk.status !== BLOCKED) {
        return;
      }
      const resolveListeners = chunk.value;
      const initializedChunk                      = (chunk     );
      initializedChunk.status = INITIALIZED;
      initializedChunk.value = blocked.value;
      if (resolveListeners !== null) {
        wakeChunk(resolveListeners, blocked.value);
      }
    }
  };
}

function createModelReject   (chunk              )                         {
  return (error       ) => triggerErrorOnChunk(chunk, error);
}

function createServerReferenceProxy                     (
  response          ,
  metaData                                               ,
)                       {
  const callServer = response._callServer;
  const proxy = function ()             {
    // $FlowFixMe[method-unbinding]
    const args = Array.prototype.slice.call(arguments);
    const p = metaData.bound;
    if (!p) {
      return callServer(metaData.id, args);
    }
    if (p.status === INITIALIZED) {
      const bound = p.value;
      return callServer(metaData.id, bound.concat(args));
    }
    // Since this is a fake Promise whose .then doesn't chain, we have to wrap it.
    // TODO: Remove the wrapper once that's fixed.
    return ((Promise.resolve(p)     )                     ).then(function (
      bound,
    ) {
      return callServer(metaData.id, bound.concat(args));
    });
  };
  // Expose encoder for use by SSR.
  // TODO: Only expose this in SSR builds and not the browser client.
  proxy.$$FORM_ACTION = encodeFormAction;
  knownServerReferences.set(proxy, metaData);
  return proxy;
}

function parseModelString(
  response          ,
  parentObject        ,
  key        ,
  value        ,
)      {
  if (value[0] === '$') {
    if (value === '$') {
      // A very common symbol.
      return REACT_ELEMENT_TYPE;
    }
    switch (value[1]) {
      case '$': {
        // This was an escaped string value.
        return value.slice(1);
      }
      case 'L': {
        // Lazy node
        const id = parseInt(value.slice(2), 16);
        const chunk = getChunk(response, id);
        // We create a React.lazy wrapper around any lazy values.
        // When passed into React, we'll know how to suspend on this.
        return createLazyChunkWrapper(chunk);
      }
      case '@': {
        // Promise
        const id = parseInt(value.slice(2), 16);
        const chunk = getChunk(response, id);
        return chunk;
      }
      case 'S': {
        // Symbol
        return Symbol.for(value.slice(2));
      }
      case 'P': {
        // Server Context Provider
        return getOrCreateServerContext(value.slice(2)).Provider;
      }
      case 'F': {
        // Server Reference
        const id = parseInt(value.slice(2), 16);
        const chunk = getChunk(response, id);
        switch (chunk.status) {
          case RESOLVED_MODEL:
            initializeModelChunk(chunk);
            break;
        }
        // The status might have changed after initialization.
        switch (chunk.status) {
          case INITIALIZED: {
            const metadata = chunk.value;
            return createServerReferenceProxy(response, metadata);
          }
          // We always encode it first in the stream so it won't be pending.
          default:
            throw chunk.reason;
        }
      }
      case 'I': {
        // $Infinity
        return Infinity;
      }
      case '-': {
        // $-0 or $-Infinity
        if (value === '$-0') {
          return -0;
        } else {
          return -Infinity;
        }
      }
      case 'N': {
        // $NaN
        return NaN;
      }
      case 'u': {
        // matches "$undefined"
        // Special encoding for `undefined` which can't be serialized as JSON otherwise.
        return undefined;
      }
      case 'D': {
        // Date
        return new Date(Date.parse(value.slice(2)));
      }
      case 'n': {
        // BigInt
        return BigInt(value.slice(2));
      }
      default: {
        // We assume that anything else is a reference ID.
        const id = parseInt(value.slice(1), 16);
        const chunk = getChunk(response, id);
        switch (chunk.status) {
          case RESOLVED_MODEL:
            initializeModelChunk(chunk);
            break;
          case RESOLVED_MODULE:
            initializeModuleChunk(chunk);
            break;
        }
        // The status might have changed after initialization.
        switch (chunk.status) {
          case INITIALIZED:
            return chunk.value;
          case PENDING:
          case BLOCKED:
            const parentChunk = initializingChunk;
            chunk.then(
              createModelResolver(parentChunk, parentObject, key),
              createModelReject(parentChunk),
            );
            return null;
          default:
            throw chunk.reason;
        }
      }
    }
  }
  return value;
}

function parseModelTuple(
  response          ,
  value                                                         ,
)      {
  const tuple                               = (value     );

  if (tuple[0] === REACT_ELEMENT_TYPE) {
    // TODO: Consider having React just directly accept these arrays as elements.
    // Or even change the ReactElement type to be an array.
    return createElement(tuple[1], tuple[2], tuple[3]);
  }
  return value;
}

function missingCall() {
  throw new Error(
    'Trying to call a function from "use server" but the callServer option ' +
      'was not implemented in your router runtime.',
  );
}

export function createResponse(
  bundlerConfig             ,
  callServer                           ,
)           {
  const chunks                              = new Map();
  const response           = {
    _bundlerConfig: bundlerConfig,
    _callServer: callServer !== undefined ? callServer : missingCall,
    _chunks: chunks,
    _partialRow: '',
    _stringDecoder: (null     ),
    _fromJSON: (null     ),
  };
  if (supportsBinaryStreams) {
    response._stringDecoder = createStringDecoder();
  }
  // Don't inline this call because it causes closure to outline the call above.
  response._fromJSON = createFromJSONCallback(response);
  return response;
}

function resolveModel(
  response          ,
  id        ,
  model                    ,
)       {
  const chunks = response._chunks;
  const chunk = chunks.get(id);
  if (!chunk) {
    chunks.set(id, createResolvedModelChunk(response, model));
  } else {
    resolveModelChunk(chunk, model);
  }
}

function resolveModule(
  response          ,
  id        ,
  model                    ,
)       {
  const chunks = response._chunks;
  const chunk = chunks.get(id);
  const clientReferenceMetadata                          = parseModel(
    response,
    model,
  );
  const clientReference = resolveClientReference            (
    response._bundlerConfig,
    clientReferenceMetadata,
  );

  // TODO: Add an option to encode modules that are lazy loaded.
  // For now we preload all modules as early as possible since it's likely
  // that we'll need them.
  const promise = preloadModule(clientReference);
  if (promise) {
    let blockedChunk                   ;
    if (!chunk) {
      // Technically, we should just treat promise as the chunk in this
      // case. Because it'll just behave as any other promise.
      blockedChunk = createBlockedChunk(response);
      chunks.set(id, blockedChunk);
    } else {
      // This can't actually happen because we don't have any forward
      // references to modules.
      blockedChunk = (chunk     );
      blockedChunk.status = BLOCKED;
    }
    promise.then(
      () => resolveModuleChunk(blockedChunk, clientReference),
      error => triggerErrorOnChunk(blockedChunk, error),
    );
  } else {
    if (!chunk) {
      chunks.set(id, createResolvedModuleChunk(response, clientReference));
    } else {
      // This can't actually happen because we don't have any forward
      // references to modules.
      resolveModuleChunk(chunk, clientReference);
    }
  }
}

                                                 
function resolveErrorProd(
  response          ,
  id        ,
  digest        ,
)       {
  if (__DEV__) {
    // These errors should never make it into a build so we don't need to encode them in codes.json
    // eslint-disable-next-line react-internal/prod-error-codes
    throw new Error(
      'resolveErrorProd should never be called in development mode. Use resolveErrorDev instead. This is a bug in React.',
    );
  }
  const error = new Error(
    'An error occurred in the Server Components render. The specific message is omitted in production' +
      ' builds to avoid leaking sensitive details. A digest property is included on this error instance which' +
      ' may provide additional details about the nature of the error.',
  );
  error.stack = 'Error: ' + error.message;
  (error     ).digest = digest;
  const errorWithDigest                  = (error     );
  const chunks = response._chunks;
  const chunk = chunks.get(id);
  if (!chunk) {
    chunks.set(id, createErrorChunk(response, errorWithDigest));
  } else {
    triggerErrorOnChunk(chunk, errorWithDigest);
  }
}

function resolveErrorDev(
  response          ,
  id        ,
  digest        ,
  message        ,
  stack        ,
)       {
  if (!__DEV__) {
    // These errors should never make it into a build so we don't need to encode them in codes.json
    // eslint-disable-next-line react-internal/prod-error-codes
    throw new Error(
      'resolveErrorDev should never be called in production mode. Use resolveErrorProd instead. This is a bug in React.',
    );
  }
  // eslint-disable-next-line react-internal/prod-error-codes
  const error = new Error(
    message ||
      'An error occurred in the Server Components render but no message was provided',
  );
  error.stack = stack;
  (error     ).digest = digest;
  const errorWithDigest                  = (error     );
  const chunks = response._chunks;
  const chunk = chunks.get(id);
  if (!chunk) {
    chunks.set(id, createErrorChunk(response, errorWithDigest));
  } else {
    triggerErrorOnChunk(chunk, errorWithDigest);
  }
}

function resolveHint(
  response          ,
  code        ,
  model                    ,
)       {
  const hintModel = parseModel           (response, model);
  dispatchHint(code, hintModel);
}

function processFullRow(response          , row        )       {
  if (row === '') {
    return;
  }
  const colon = row.indexOf(':', 0);
  const id = parseInt(row.slice(0, colon), 16);
  const tag = row[colon + 1];
  // When tags that are not text are added, check them here before
  // parsing the row as text.
  // switch (tag) {
  // }
  switch (tag) {
    case 'I': {
      resolveModule(response, id, row.slice(colon + 2));
      return;
    }
    case 'H': {
      const code = row[colon + 2];
      resolveHint(response, code, row.slice(colon + 3));
      return;
    }
    case 'E': {
      const errorInfo = JSON.parse(row.slice(colon + 2));
      if (__DEV__) {
        resolveErrorDev(
          response,
          id,
          errorInfo.digest,
          errorInfo.message,
          errorInfo.stack,
        );
      } else {
        resolveErrorProd(response, id, errorInfo.digest);
      }
      return;
    }
    default: {
      // We assume anything else is JSON.
      resolveModel(response, id, row.slice(colon + 1));
      return;
    }
  }
}

export function processStringChunk(
  response          ,
  chunk        ,
  offset        ,
)       {
  let linebreak = chunk.indexOf('\n', offset);
  while (linebreak > -1) {
    const fullrow = response._partialRow + chunk.slice(offset, linebreak);
    processFullRow(response, fullrow);
    response._partialRow = '';
    offset = linebreak + 1;
    linebreak = chunk.indexOf('\n', offset);
  }
  response._partialRow += chunk.slice(offset);
}

export function processBinaryChunk(
  response          ,
  chunk            ,
)       {
  if (!supportsBinaryStreams) {
    throw new Error("This environment don't support binary chunks.");
  }
  const stringDecoder = response._stringDecoder;
  let linebreak = chunk.indexOf(10); // newline
  while (linebreak > -1) {
    const fullrow =
      response._partialRow +
      readFinalStringChunk(stringDecoder, chunk.subarray(0, linebreak));
    processFullRow(response, fullrow);
    response._partialRow = '';
    chunk = chunk.subarray(linebreak + 1);
    linebreak = chunk.indexOf(10); // newline
  }
  response._partialRow += readPartialStringChunk(stringDecoder, chunk);
}

function parseModel   (response          , json                    )    {
  return JSON.parse(json, response._fromJSON);
}

function createFromJSONCallback(response          ) {
  // $FlowFixMe[missing-this-annot]
  return function (key        , value           ) {
    if (typeof value === 'string') {
      // We can't use .bind here because we need the "this" value.
      return parseModelString(response, this, key, value);
    }
    if (typeof value === 'object' && value !== null) {
      return parseModelTuple(response, value);
    }
    return value;
  };
}

export function close(response          )       {
  // In case there are any remaining unresolved chunks, they won't
  // be resolved now. So we need to issue an error to those.
  // Ideally we should be able to early bail out if we kept a
  // ref count of pending chunks.
  reportGlobalError(response, new Error('Connection closed.'));
}

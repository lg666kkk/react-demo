/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *      
 */

                                                                  

import {
  scheduleWork,
  flushBuffered,
  beginWriting,
  writeChunkAndReturn,
  stringToChunk,
  completeWriting,
  close,
  closeWithError,
} from './ReactServerStreamConfig';

                                                                  

             
                 
                          
                  
                     
                  
                    
        
            
                                   
                                                             
                                                         
             
                    
                         
           
           
                  
                    
                   
                     
                           
                                                       

import {
  resolveClientReferenceMetadata,
  getServerReferenceId,
  getServerReferenceBoundArguments,
  getClientReferenceKey,
  isClientReference,
  isServerReference,
  supportsRequestStorage,
  requestStorage,
  prepareHostDispatcher,
  createHints,
} from './ReactFlightServerConfig';

import {
  HooksDispatcher,
  prepareToUseHooksForRequest,
  prepareToUseHooksForComponent,
  getThenableStateAfterSuspending,
  resetHooksForRequest,
} from './ReactFlightHooks';
import {DefaultCacheDispatcher} from './flight/ReactFlightServerCache';
import {
  pushProvider,
  popProvider,
  switchContext,
  getActiveContext,
  rootContextSnapshot,
} from './ReactFlightNewContext';

import {
  getIteratorFn,
  REACT_ELEMENT_TYPE,
  REACT_FORWARD_REF_TYPE,
  REACT_FRAGMENT_TYPE,
  REACT_LAZY_TYPE,
  REACT_MEMO_TYPE,
  REACT_PROVIDER_TYPE,
} from 'shared/ReactSymbols';

import {
  describeValueForErrorMessage,
  describeObjectForErrorMessage,
  isSimpleObject,
  jsxPropsParents,
  jsxChildrenParents,
  objectName,
} from 'shared/ReactSerializationErrors';

import {getOrCreateServerContext} from 'shared/ReactServerContextRegistry';
import ReactSharedInternals from 'shared/ReactSharedInternals';
import isArray from 'shared/isArray';
import {SuspenseException, getSuspendedThenable} from './ReactFlightThenable';

                
          
           
          
        
                               
                              

const stringify = JSON.stringify;

                     
          
           
          
        
                                  
                      

// Serializable values
                              
                                                                    
                                                    
                                        
                                         
                        
                        
                                                                         
                                                            
                         
                                             
                           
          
           
          
          
        
        
                              
                           
                     
                               // Thenable<ReactClientValue>

                                                            

const PENDING = 0;
const COMPLETED = 1;
const ABORTED = 3;
const ERRORED = 4;

             
             
                        
                          
                   
                           
                                      
  

                       
                    
                          
                    
                                  
                                
                              
                      
                        
               
                            
                           
                                      
                                    
                                    
                                     
                                      
                                                           
                                                             
                                        
                           
                          
                                     
                                                                   
  

const ReactCurrentDispatcher = ReactSharedInternals.ReactCurrentDispatcher;
const ReactCurrentCache = ReactSharedInternals.ReactCurrentCache;

function defaultErrorHandler(error       ) {
  console['error'](error);
  // Don't transform to our wrapper
}

const OPEN = 0;
const CLOSING = 1;
const CLOSED = 2;

export function createRequest(
  model                  ,
  bundlerConfig                ,
  onError                                    ,
  context                                          ,
  identifierPrefix         ,
)          {
  if (
    ReactCurrentCache.current !== null &&
    ReactCurrentCache.current !== DefaultCacheDispatcher
  ) {
    throw new Error(
      'Currently React only supports one RSC renderer at a time.',
    );
  }
  prepareHostDispatcher();
  ReactCurrentCache.current = DefaultCacheDispatcher;

  const abortSet            = new Set();
  const pingedTasks              = [];
  const hints = createHints();
  const request          = {
    status: OPEN,
    flushScheduled: false,
    fatalError: null,
    destination: null,
    bundlerConfig,
    cache: new Map(),
    nextChunkId: 0,
    pendingChunks: 0,
    hints,
    abortableTasks: abortSet,
    pingedTasks: pingedTasks,
    completedImportChunks: ([]              ),
    completedHintChunks: ([]              ),
    completedJSONChunks: ([]              ),
    completedErrorChunks: ([]              ),
    writtenSymbols: new Map(),
    writtenClientReferences: new Map(),
    writtenServerReferences: new Map(),
    writtenProviders: new Map(),
    identifierPrefix: identifierPrefix || '',
    identifierCount: 1,
    onError: onError === undefined ? defaultErrorHandler : onError,
    // $FlowFixMe[missing-this-annot]
    toJSON: function (key        , value                  )                 {
      return resolveModelToJSON(request, this, key, value);
    },
  };
  request.pendingChunks++;
  const rootContext = createRootContext(context);
  const rootTask = createTask(request, model, rootContext, abortSet);
  pingedTasks.push(rootTask);
  return request;
}

let currentRequest                 = null;

export function resolveRequest()                 {
  if (currentRequest) return currentRequest;
  if (supportsRequestStorage) {
    const store = requestStorage.getStore();
    if (store) return store;
  }
  return null;
}

function createRootContext(
  reqContext                                          ,
) {
  return importServerContexts(reqContext);
}

const POP = {};

function serializeThenable(request         , thenable               )         {
  request.pendingChunks++;
  const newTask = createTask(
    request,
    null,
    getActiveContext(),
    request.abortableTasks,
  );

  switch (thenable.status) {
    case 'fulfilled': {
      // We have the resolved value, we can go ahead and schedule it for serialization.
      newTask.model = thenable.value;
      pingTask(request, newTask);
      return newTask.id;
    }
    case 'rejected': {
      const x = thenable.reason;
      const digest = logRecoverableError(request, x);
      if (__DEV__) {
        const {message, stack} = getErrorMessageAndStackDev(x);
        emitErrorChunkDev(request, newTask.id, digest, message, stack);
      } else {
        emitErrorChunkProd(request, newTask.id, digest);
      }
      return newTask.id;
    }
    default: {
      if (typeof thenable.status === 'string') {
        // Only instrument the thenable if the status if not defined. If
        // it's defined, but an unknown value, assume it's been instrumented by
        // some custom userspace implementation. We treat it as "pending".
        break;
      }
      const pendingThenable                         = (thenable     );
      pendingThenable.status = 'pending';
      pendingThenable.then(
        fulfilledValue => {
          if (thenable.status === 'pending') {
            const fulfilledThenable                           = (thenable     );
            fulfilledThenable.status = 'fulfilled';
            fulfilledThenable.value = fulfilledValue;
          }
        },
        (error       ) => {
          if (thenable.status === 'pending') {
            const rejectedThenable                          = (thenable     );
            rejectedThenable.status = 'rejected';
            rejectedThenable.reason = error;
          }
        },
      );
      break;
    }
  }

  thenable.then(
    value => {
      newTask.model = value;
      pingTask(request, newTask);
    },
    reason => {
      newTask.status = ERRORED;
      // TODO: We should ideally do this inside performWork so it's scheduled
      const digest = logRecoverableError(request, reason);
      if (__DEV__) {
        const {message, stack} = getErrorMessageAndStackDev(reason);
        emitErrorChunkDev(request, newTask.id, digest, message, stack);
      } else {
        emitErrorChunkProd(request, newTask.id, digest);
      }
      if (request.destination !== null) {
        flushCompletedChunks(request, request.destination);
      }
    },
  );

  return newTask.id;
}

export function emitHint(
  request         ,
  code        ,
  model           ,
)       {
  emitHintChunk(request, code, model);
  enqueueFlush(request);
}

export function getHints(request         )        {
  return request.hints;
}

export function getCache(request         )                       {
  return request.cache;
}

function readThenable   (thenable             )    {
  if (thenable.status === 'fulfilled') {
    return thenable.value;
  } else if (thenable.status === 'rejected') {
    throw thenable.reason;
  }
  throw thenable;
}

function createLazyWrapperAroundWakeable(wakeable          ) {
  // This is a temporary fork of the `use` implementation until we accept
  // promises everywhere.
  const thenable                  = (wakeable     );
  switch (thenable.status) {
    case 'fulfilled':
    case 'rejected':
      break;
    default: {
      if (typeof thenable.status === 'string') {
        // Only instrument the thenable if the status if not defined. If
        // it's defined, but an unknown value, assume it's been instrumented by
        // some custom userspace implementation. We treat it as "pending".
        break;
      }
      const pendingThenable                         = (thenable     );
      pendingThenable.status = 'pending';
      pendingThenable.then(
        fulfilledValue => {
          if (thenable.status === 'pending') {
            const fulfilledThenable                           = (thenable     );
            fulfilledThenable.status = 'fulfilled';
            fulfilledThenable.value = fulfilledValue;
          }
        },
        (error       ) => {
          if (thenable.status === 'pending') {
            const rejectedThenable                          = (thenable     );
            rejectedThenable.status = 'rejected';
            rejectedThenable.reason = error;
          }
        },
      );
      break;
    }
  }
  const lazyType                                    = {
    $$typeof: REACT_LAZY_TYPE,
    _payload: thenable,
    _init: readThenable,
  };
  return lazyType;
}

function attemptResolveElement(
  request         ,
  type     ,
  key                  ,
  ref       ,
  props     ,
  prevThenableState                      ,
)                   {
  if (ref !== null && ref !== undefined) {
    // When the ref moves to the regular props object this will implicitly
    // throw for functions. We could probably relax it to a DEV warning for other
    // cases.
    throw new Error(
      'Refs cannot be used in Server Components, nor passed to Client Components.',
    );
  }
  if (__DEV__) {
    jsxPropsParents.set(props, type);
    if (typeof props.children === 'object' && props.children !== null) {
      jsxChildrenParents.set(props.children, type);
    }
  }
  if (typeof type === 'function') {
    if (isClientReference(type)) {
      // This is a reference to a Client Component.
      return [REACT_ELEMENT_TYPE, type, key, props];
    }
    // This is a server-side component.
    prepareToUseHooksForComponent(prevThenableState);
    const result = type(props);
    if (
      typeof result === 'object' &&
      result !== null &&
      typeof result.then === 'function'
    ) {
      // When the return value is in children position we can resolve it immediately,
      // to its value without a wrapper if it's synchronously available.
      const thenable                = result;
      if (thenable.status === 'fulfilled') {
        return thenable.value;
      }
      // TODO: Once we accept Promises as children on the client, we can just return
      // the thenable here.
      return createLazyWrapperAroundWakeable(result);
    }
    return result;
  } else if (typeof type === 'string') {
    // This is a host element. E.g. HTML.
    return [REACT_ELEMENT_TYPE, type, key, props];
  } else if (typeof type === 'symbol') {
    if (type === REACT_FRAGMENT_TYPE) {
      // For key-less fragments, we add a small optimization to avoid serializing
      // it as a wrapper.
      // TODO: If a key is specified, we should propagate its key to any children.
      // Same as if a Server Component has a key.
      return props.children;
    }
    // This might be a built-in React component. We'll let the client decide.
    // Any built-in works as long as its props are serializable.
    return [REACT_ELEMENT_TYPE, type, key, props];
  } else if (type != null && typeof type === 'object') {
    if (isClientReference(type)) {
      // This is a reference to a Client Component.
      return [REACT_ELEMENT_TYPE, type, key, props];
    }
    switch (type.$$typeof) {
      case REACT_LAZY_TYPE: {
        const payload = type._payload;
        const init = type._init;
        const wrappedType = init(payload);
        return attemptResolveElement(
          request,
          wrappedType,
          key,
          ref,
          props,
          prevThenableState,
        );
      }
      case REACT_FORWARD_REF_TYPE: {
        const render = type.render;
        prepareToUseHooksForComponent(prevThenableState);
        return render(props, undefined);
      }
      case REACT_MEMO_TYPE: {
        return attemptResolveElement(
          request,
          type.type,
          key,
          ref,
          props,
          prevThenableState,
        );
      }
      case REACT_PROVIDER_TYPE: {
        pushProvider(type._context, props.value);
        if (__DEV__) {
          const extraKeys = Object.keys(props).filter(value => {
            if (value === 'children' || value === 'value') {
              return false;
            }
            return true;
          });
          if (extraKeys.length !== 0) {
            console.error(
              'ServerContext can only have a value prop and children. Found: %s',
              JSON.stringify(extraKeys),
            );
          }
        }
        return [
          REACT_ELEMENT_TYPE,
          type,
          key,
          // Rely on __popProvider being serialized last to pop the provider.
          {value: props.value, children: props.children, __pop: POP},
        ];
      }
    }
  }
  throw new Error(
    `Unsupported Server Component type: ${describeValueForErrorMessage(type)}`,
  );
}

function pingTask(request         , task      )       {
  const pingedTasks = request.pingedTasks;
  pingedTasks.push(task);
  if (pingedTasks.length === 1) {
    request.flushScheduled = request.destination !== null;
    scheduleWork(() => performWork(request));
  }
}

function createTask(
  request         ,
  model                  ,
  context                 ,
  abortSet           ,
)       {
  const id = request.nextChunkId++;
  const task       = {
    id,
    status: PENDING,
    model,
    context,
    ping: () => pingTask(request, task),
    thenableState: null,
  };
  abortSet.add(task);
  return task;
}

function serializeByValueID(id        )         {
  return '$' + id.toString(16);
}

function serializeLazyID(id        )         {
  return '$L' + id.toString(16);
}

function serializePromiseID(id        )         {
  return '$@' + id.toString(16);
}

function serializeServerReferenceID(id        )         {
  return '$F' + id.toString(16);
}

function serializeSymbolReference(name        )         {
  return '$S' + name;
}

function serializeProviderReference(name        )         {
  return '$P' + name;
}

function serializeNumber(number        )                  {
  if (Number.isFinite(number)) {
    if (number === 0 && 1 / number === -Infinity) {
      return '$-0';
    } else {
      return number;
    }
  } else {
    if (number === Infinity) {
      return '$Infinity';
    } else if (number === -Infinity) {
      return '$-Infinity';
    } else {
      return '$NaN';
    }
  }
}

function serializeUndefined()         {
  return '$undefined';
}

function serializeDateFromDateJSON(dateJSON        )         {
  // JSON.stringify automatically calls Date.prototype.toJSON which calls toISOString.
  // We need only tack on a $D prefix.
  return '$D' + dateJSON;
}

function serializeBigInt(n        )         {
  return '$n' + n.toString(10);
}

function serializeClientReference(
  request         ,
  parent 
                                                 
                                      ,
  key        ,
  clientReference                      ,
)         {
  const clientReferenceKey                     =
    getClientReferenceKey(clientReference);
  const writtenClientReferences = request.writtenClientReferences;
  const existingId = writtenClientReferences.get(clientReferenceKey);
  if (existingId !== undefined) {
    if (parent[0] === REACT_ELEMENT_TYPE && key === '1') {
      // If we're encoding the "type" of an element, we can refer
      // to that by a lazy reference instead of directly since React
      // knows how to deal with lazy values. This lets us suspend
      // on this component rather than its parent until the code has
      // loaded.
      return serializeLazyID(existingId);
    }
    return serializeByValueID(existingId);
  }
  try {
    const clientReferenceMetadata                          =
      resolveClientReferenceMetadata(request.bundlerConfig, clientReference);
    request.pendingChunks++;
    const importId = request.nextChunkId++;
    emitImportChunk(request, importId, clientReferenceMetadata);
    writtenClientReferences.set(clientReferenceKey, importId);
    if (parent[0] === REACT_ELEMENT_TYPE && key === '1') {
      // If we're encoding the "type" of an element, we can refer
      // to that by a lazy reference instead of directly since React
      // knows how to deal with lazy values. This lets us suspend
      // on this component rather than its parent until the code has
      // loaded.
      return serializeLazyID(importId);
    }
    return serializeByValueID(importId);
  } catch (x) {
    request.pendingChunks++;
    const errorId = request.nextChunkId++;
    const digest = logRecoverableError(request, x);
    if (__DEV__) {
      const {message, stack} = getErrorMessageAndStackDev(x);
      emitErrorChunkDev(request, errorId, digest, message, stack);
    } else {
      emitErrorChunkProd(request, errorId, digest);
    }
    return serializeByValueID(errorId);
  }
}

function serializeServerReference(
  request         ,
  parent 
                                                 
                                      ,
  key        ,
  serverReference                      ,
)         {
  const writtenServerReferences = request.writtenServerReferences;
  const existingId = writtenServerReferences.get(serverReference);
  if (existingId !== undefined) {
    return serializeServerReferenceID(existingId);
  }

  const bound                    = getServerReferenceBoundArguments(
    request.bundlerConfig,
    serverReference,
  );
  const serverReferenceMetadata   
                          
                                      
    = {
    id: getServerReferenceId(request.bundlerConfig, serverReference),
    bound: bound ? Promise.resolve(bound) : null,
  };
  request.pendingChunks++;
  const metadataId = request.nextChunkId++;
  // We assume that this object doesn't suspend.
  const processedChunk = processModelChunk(
    request,
    metadataId,
    serverReferenceMetadata,
  );
  request.completedJSONChunks.push(processedChunk);
  writtenServerReferences.set(serverReference, metadataId);
  return serializeServerReferenceID(metadataId);
}

function escapeStringValue(value        )         {
  if (value[0] === '$') {
    // We need to escape $ prefixed strings since we use those to encode
    // references to IDs and as special symbol values.
    return '$' + value;
  } else {
    return value;
  }
}

let insideContextProps = null;
let isInsideContextValue = false;

function resolveModelToJSON(
  request         ,
  parent 
                                                 
                                      ,
  key        ,
  value                  ,
)                 {
  // Make sure that `parent[key]` wasn't JSONified before `value` was passed to us
  if (__DEV__) {
    // $FlowFixMe[incompatible-use]
    const originalValue = parent[key];
    if (
      typeof originalValue === 'object' &&
      originalValue !== value &&
      !(originalValue instanceof Date)
    ) {
      if (objectName(originalValue) !== 'Object') {
        const jsxParentType = jsxChildrenParents.get(parent);
        if (typeof jsxParentType === 'string') {
          console.error(
            '%s objects cannot be rendered as text children. Try formatting it using toString().%s',
            objectName(originalValue),
            describeObjectForErrorMessage(parent, key),
          );
        } else {
          console.error(
            'Only plain objects can be passed to Client Components from Server Components. ' +
              '%s objects are not supported.%s',
            objectName(originalValue),
            describeObjectForErrorMessage(parent, key),
          );
        }
      } else {
        console.error(
          'Only plain objects can be passed to Client Components from Server Components. ' +
            'Objects with toJSON methods are not supported. Convert it manually ' +
            'to a simple value before passing it to props.%s',
          describeObjectForErrorMessage(parent, key),
        );
      }
    }
  }

  // Special Symbols
  switch (value) {
    case REACT_ELEMENT_TYPE:
      return '$';
  }

  if (__DEV__) {
    if (
      parent[0] === REACT_ELEMENT_TYPE &&
      parent[1] &&
      (parent[1]     ).$$typeof === REACT_PROVIDER_TYPE &&
      key === '3'
    ) {
      insideContextProps = value;
    } else if (insideContextProps === parent && key === 'value') {
      isInsideContextValue = true;
    } else if (insideContextProps === parent && key === 'children') {
      isInsideContextValue = false;
    }
  }

  // Resolve Server Components.
  while (
    typeof value === 'object' &&
    value !== null &&
    ((value     ).$$typeof === REACT_ELEMENT_TYPE ||
      (value     ).$$typeof === REACT_LAZY_TYPE)
  ) {
    if (__DEV__) {
      if (isInsideContextValue) {
        console.error('React elements are not allowed in ServerContext');
      }
    }

    try {
      switch ((value     ).$$typeof) {
        case REACT_ELEMENT_TYPE: {
          // TODO: Concatenate keys of parents onto children.
          const element                     = (value     );
          // Attempt to render the Server Component.
          value = attemptResolveElement(
            request,
            element.type,
            element.key,
            element.ref,
            element.props,
            null,
          );
          break;
        }
        case REACT_LAZY_TYPE: {
          const payload = (value     )._payload;
          const init = (value     )._init;
          value = init(payload);
          break;
        }
      }
    } catch (thrownValue) {
      const x =
        thrownValue === SuspenseException
          ? // This is a special type of exception used for Suspense. For historical
            // reasons, the rest of the Suspense implementation expects the thrown
            // value to be a thenable, because before `use` existed that was the
            // (unstable) API for suspending. This implementation detail can change
            // later, once we deprecate the old API in favor of `use`.
            getSuspendedThenable()
          : thrownValue;
      // $FlowFixMe[method-unbinding]
      if (typeof x === 'object' && x !== null && typeof x.then === 'function') {
        // Something suspended, we'll need to create a new task and resolve it later.
        request.pendingChunks++;
        const newTask = createTask(
          request,
          value,
          getActiveContext(),
          request.abortableTasks,
        );
        const ping = newTask.ping;
        x.then(ping, ping);
        newTask.thenableState = getThenableStateAfterSuspending();
        return serializeLazyID(newTask.id);
      } else {
        // Something errored. We'll still send everything we have up until this point.
        // We'll replace this element with a lazy reference that throws on the client
        // once it gets rendered.
        request.pendingChunks++;
        const errorId = request.nextChunkId++;
        const digest = logRecoverableError(request, x);
        if (__DEV__) {
          const {message, stack} = getErrorMessageAndStackDev(x);
          emitErrorChunkDev(request, errorId, digest, message, stack);
        } else {
          emitErrorChunkProd(request, errorId, digest);
        }
        return serializeLazyID(errorId);
      }
    }
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'object') {
    if (isClientReference(value)) {
      return serializeClientReference(request, parent, key, (value     ));
      // $FlowFixMe[method-unbinding]
    } else if (typeof value.then === 'function') {
      // We assume that any object with a .then property is a "Thenable" type,
      // or a Promise type. Either of which can be represented by a Promise.
      const promiseId = serializeThenable(request, (value     ));
      return serializePromiseID(promiseId);
    } else if ((value     ).$$typeof === REACT_PROVIDER_TYPE) {
      const providerKey = ((value     )                        )._context
        ._globalName;
      const writtenProviders = request.writtenProviders;
      let providerId = writtenProviders.get(key);
      if (providerId === undefined) {
        request.pendingChunks++;
        providerId = request.nextChunkId++;
        writtenProviders.set(providerKey, providerId);
        emitProviderChunk(request, providerId, providerKey);
      }
      return serializeByValueID(providerId);
    } else if (value === POP) {
      popProvider();
      if (__DEV__) {
        insideContextProps = null;
        isInsideContextValue = false;
      }
      return (undefined     );
    }
    if (!isArray(value)) {
      const iteratorFn = getIteratorFn(value);
      if (iteratorFn) {
        return Array.from((value     ));
      }
    }

    if (__DEV__) {
      if (value !== null && !isArray(value)) {
        // Verify that this is a simple plain object.
        if (objectName(value) !== 'Object') {
          console.error(
            'Only plain objects can be passed to Client Components from Server Components. ' +
              '%s objects are not supported.%s',
            objectName(value),
            describeObjectForErrorMessage(parent, key),
          );
        } else if (!isSimpleObject(value)) {
          console.error(
            'Only plain objects can be passed to Client Components from Server Components. ' +
              'Classes or other objects with methods are not supported.%s',
            describeObjectForErrorMessage(parent, key),
          );
        } else if (Object.getOwnPropertySymbols) {
          const symbols = Object.getOwnPropertySymbols(value);
          if (symbols.length > 0) {
            console.error(
              'Only plain objects can be passed to Client Components from Server Components. ' +
                'Objects with symbol properties like %s are not supported.%s',
              symbols[0].description,
              describeObjectForErrorMessage(parent, key),
            );
          }
        }
      }
    }

    // $FlowFixMe[incompatible-return]
    return value;
  }

  if (typeof value === 'string') {
    // TODO: Maybe too clever. If we support URL there's no similar trick.
    if (value[value.length - 1] === 'Z') {
      // Possibly a Date, whose toJSON automatically calls toISOString
      // $FlowFixMe[incompatible-use]
      const originalValue = parent[key];
      if (originalValue instanceof Date) {
        return serializeDateFromDateJSON(value);
      }
    }

    return escapeStringValue(value);
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return serializeNumber(value);
  }

  if (typeof value === 'undefined') {
    return serializeUndefined();
  }

  if (typeof value === 'function') {
    if (isClientReference(value)) {
      return serializeClientReference(request, parent, key, (value     ));
    }
    if (isServerReference(value)) {
      return serializeServerReference(request, parent, key, (value     ));
    }
    if (/^on[A-Z]/.test(key)) {
      throw new Error(
        'Event handlers cannot be passed to Client Component props.' +
          describeObjectForErrorMessage(parent, key) +
          '\nIf you need interactivity, consider converting part of this to a Client Component.',
      );
    } else {
      throw new Error(
        'Functions cannot be passed directly to Client Components ' +
          'unless you explicitly expose it by marking it with "use server".' +
          describeObjectForErrorMessage(parent, key),
      );
    }
  }

  if (typeof value === 'symbol') {
    const writtenSymbols = request.writtenSymbols;
    const existingId = writtenSymbols.get(value);
    if (existingId !== undefined) {
      return serializeByValueID(existingId);
    }
    // $FlowFixMe[incompatible-type] `description` might be undefined
    const name         = value.description;

    if (Symbol.for(name) !== value) {
      throw new Error(
        'Only global symbols received from Symbol.for(...) can be passed to Client Components. ' +
          `The symbol Symbol.for(${
            // $FlowFixMe[incompatible-type] `description` might be undefined
            value.description
          }) cannot be found among global symbols.` +
          describeObjectForErrorMessage(parent, key),
      );
    }

    request.pendingChunks++;
    const symbolId = request.nextChunkId++;
    emitSymbolChunk(request, symbolId, name);
    writtenSymbols.set(value, symbolId);
    return serializeByValueID(symbolId);
  }

  if (typeof value === 'bigint') {
    return serializeBigInt(value);
  }

  throw new Error(
    `Type ${typeof value} is not supported in Client Component props.` +
      describeObjectForErrorMessage(parent, key),
  );
}

function logRecoverableError(request         , error       )         {
  const onError = request.onError;
  const errorDigest = onError(error);
  if (errorDigest != null && typeof errorDigest !== 'string') {
    // eslint-disable-next-line react-internal/prod-error-codes
    throw new Error(
      `onError returned something with a type other than "string". onError should return a string and may return null or undefined but must not return anything else. It received something of type "${typeof errorDigest}" instead`,
    );
  }
  return errorDigest || '';
}

function getErrorMessageAndStackDev(error       )   
                  
                
  {
  if (__DEV__) {
    let message;
    let stack = '';
    try {
      if (error instanceof Error) {
        // eslint-disable-next-line react-internal/safe-string-coercion
        message = String(error.message);
        // eslint-disable-next-line react-internal/safe-string-coercion
        stack = String(error.stack);
      } else {
        message = 'Error: ' + (error     );
      }
    } catch (x) {
      message = 'An error occurred but serializing the error message failed.';
    }
    return {
      message,
      stack,
    };
  } else {
    // These errors should never make it into a build so we don't need to encode them in codes.json
    // eslint-disable-next-line react-internal/prod-error-codes
    throw new Error(
      'getErrorMessageAndStackDev should never be called from production mode. This is a bug in React.',
    );
  }
}

function fatalError(request         , error       )       {
  // This is called outside error handling code such as if an error happens in React internals.
  if (request.destination !== null) {
    request.status = CLOSED;
    closeWithError(request.destination, error);
  } else {
    request.status = CLOSING;
    request.fatalError = error;
  }
}

function emitErrorChunkProd(
  request         ,
  id        ,
  digest        ,
)       {
  const processedChunk = processErrorChunkProd(request, id, digest);
  request.completedErrorChunks.push(processedChunk);
}

function emitErrorChunkDev(
  request         ,
  id        ,
  digest        ,
  message        ,
  stack        ,
)       {
  const processedChunk = processErrorChunkDev(
    request,
    id,
    digest,
    message,
    stack,
  );
  request.completedErrorChunks.push(processedChunk);
}

function emitImportChunk(
  request         ,
  id        ,
  clientReferenceMetadata                         ,
)       {
  const processedChunk = processImportChunk(
    request,
    id,
    clientReferenceMetadata,
  );
  request.completedImportChunks.push(processedChunk);
}

function emitHintChunk(request         , code        , model           )       {
  const processedChunk = processHintChunk(
    request,
    request.nextChunkId++,
    code,
    model,
  );
  request.completedHintChunks.push(processedChunk);
}

function emitSymbolChunk(request         , id        , name        )       {
  const symbolReference = serializeSymbolReference(name);
  const processedChunk = processReferenceChunk(request, id, symbolReference);
  request.completedImportChunks.push(processedChunk);
}

function emitProviderChunk(
  request         ,
  id        ,
  contextName        ,
)       {
  const contextReference = serializeProviderReference(contextName);
  const processedChunk = processReferenceChunk(request, id, contextReference);
  request.completedJSONChunks.push(processedChunk);
}

function retryTask(request         , task      )       {
  if (task.status !== PENDING) {
    // We completed this by other means before we had a chance to retry it.
    return;
  }

  switchContext(task.context);
  try {
    let value = task.model;
    if (
      typeof value === 'object' &&
      value !== null &&
      (value     ).$$typeof === REACT_ELEMENT_TYPE
    ) {
      // TODO: Concatenate keys of parents onto children.
      const element                     = (value     );

      // When retrying a component, reuse the thenableState from the
      // previous attempt.
      const prevThenableState = task.thenableState;

      // Attempt to render the Server Component.
      // Doing this here lets us reuse this same task if the next component
      // also suspends.
      task.model = value;
      value = attemptResolveElement(
        request,
        element.type,
        element.key,
        element.ref,
        element.props,
        prevThenableState,
      );

      // Successfully finished this component. We're going to keep rendering
      // using the same task, but we reset its thenable state before continuing.
      task.thenableState = null;

      // Keep rendering and reuse the same task. This inner loop is separate
      // from the render above because we don't need to reset the thenable state
      // until the next time something suspends and retries.
      while (
        typeof value === 'object' &&
        value !== null &&
        (value     ).$$typeof === REACT_ELEMENT_TYPE
      ) {
        // TODO: Concatenate keys of parents onto children.
        const nextElement                     = (value     );
        task.model = value;
        value = attemptResolveElement(
          request,
          nextElement.type,
          nextElement.key,
          nextElement.ref,
          nextElement.props,
          null,
        );
      }
    }

    const processedChunk = processModelChunk(request, task.id, value);
    request.completedJSONChunks.push(processedChunk);
    request.abortableTasks.delete(task);
    task.status = COMPLETED;
  } catch (thrownValue) {
    const x =
      thrownValue === SuspenseException
        ? // This is a special type of exception used for Suspense. For historical
          // reasons, the rest of the Suspense implementation expects the thrown
          // value to be a thenable, because before `use` existed that was the
          // (unstable) API for suspending. This implementation detail can change
          // later, once we deprecate the old API in favor of `use`.
          getSuspendedThenable()
        : thrownValue;
    // $FlowFixMe[method-unbinding]
    if (typeof x === 'object' && x !== null && typeof x.then === 'function') {
      // Something suspended again, let's pick it back up later.
      const ping = task.ping;
      x.then(ping, ping);
      task.thenableState = getThenableStateAfterSuspending();
      return;
    } else {
      request.abortableTasks.delete(task);
      task.status = ERRORED;
      const digest = logRecoverableError(request, x);
      if (__DEV__) {
        const {message, stack} = getErrorMessageAndStackDev(x);
        emitErrorChunkDev(request, task.id, digest, message, stack);
      } else {
        emitErrorChunkProd(request, task.id, digest);
      }
    }
  }
}

function performWork(request         )       {
  const prevDispatcher = ReactCurrentDispatcher.current;
  ReactCurrentDispatcher.current = HooksDispatcher;
  const prevRequest = currentRequest;
  currentRequest = request;
  prepareToUseHooksForRequest(request);

  try {
    const pingedTasks = request.pingedTasks;
    request.pingedTasks = [];
    for (let i = 0; i < pingedTasks.length; i++) {
      const task = pingedTasks[i];
      retryTask(request, task);
    }
    if (request.destination !== null) {
      flushCompletedChunks(request, request.destination);
    }
  } catch (error) {
    logRecoverableError(request, error);
    fatalError(request, error);
  } finally {
    ReactCurrentDispatcher.current = prevDispatcher;
    resetHooksForRequest();
    currentRequest = prevRequest;
  }
}

function abortTask(task      , request         , errorId        )       {
  task.status = ABORTED;
  // Instead of emitting an error per task.id, we emit a model that only
  // has a single value referencing the error.
  const ref = serializeByValueID(errorId);
  const processedChunk = processReferenceChunk(request, task.id, ref);
  request.completedErrorChunks.push(processedChunk);
}

function flushCompletedChunks(
  request         ,
  destination             ,
)       {
  beginWriting(destination);
  try {
    // We emit module chunks first in the stream so that
    // they can be preloaded as early as possible.
    const importsChunks = request.completedImportChunks;
    let i = 0;
    for (; i < importsChunks.length; i++) {
      request.pendingChunks--;
      const chunk = importsChunks[i];
      const keepWriting          = writeChunkAndReturn(destination, chunk);
      if (!keepWriting) {
        request.destination = null;
        i++;
        break;
      }
    }
    importsChunks.splice(0, i);

    // Next comes hints.
    const hintChunks = request.completedHintChunks;
    i = 0;
    for (; i < hintChunks.length; i++) {
      const chunk = hintChunks[i];
      const keepWriting          = writeChunkAndReturn(destination, chunk);
      if (!keepWriting) {
        request.destination = null;
        i++;
        break;
      }
    }
    hintChunks.splice(0, i);

    // Next comes model data.
    const jsonChunks = request.completedJSONChunks;
    i = 0;
    for (; i < jsonChunks.length; i++) {
      request.pendingChunks--;
      const chunk = jsonChunks[i];
      const keepWriting          = writeChunkAndReturn(destination, chunk);
      if (!keepWriting) {
        request.destination = null;
        i++;
        break;
      }
    }
    jsonChunks.splice(0, i);

    // Finally, errors are sent. The idea is that it's ok to delay
    // any error messages and prioritize display of other parts of
    // the page.
    const errorChunks = request.completedErrorChunks;
    i = 0;
    for (; i < errorChunks.length; i++) {
      request.pendingChunks--;
      const chunk = errorChunks[i];
      const keepWriting          = writeChunkAndReturn(destination, chunk);
      if (!keepWriting) {
        request.destination = null;
        i++;
        break;
      }
    }
    errorChunks.splice(0, i);
  } finally {
    request.flushScheduled = false;
    completeWriting(destination);
  }
  flushBuffered(destination);
  if (request.pendingChunks === 0) {
    // We're done.
    close(destination);
  }
}

export function startWork(request         )       {
  request.flushScheduled = request.destination !== null;
  if (supportsRequestStorage) {
    scheduleWork(() => requestStorage.run(request, performWork, request));
  } else {
    scheduleWork(() => performWork(request));
  }
}

function enqueueFlush(request         )       {
  if (
    request.flushScheduled === false &&
    // If there are pinged tasks we are going to flush anyway after work completes
    request.pingedTasks.length === 0 &&
    // If there is no destination there is nothing we can flush to. A flush will
    // happen when we start flowing again
    request.destination !== null
  ) {
    const destination = request.destination;
    request.flushScheduled = true;
    scheduleWork(() => flushCompletedChunks(request, destination));
  }
}

export function startFlowing(request         , destination             )       {
  if (request.status === CLOSING) {
    request.status = CLOSED;
    closeWithError(destination, request.fatalError);
    return;
  }
  if (request.status === CLOSED) {
    return;
  }
  if (request.destination !== null) {
    // We're already flowing.
    return;
  }
  request.destination = destination;
  try {
    flushCompletedChunks(request, destination);
  } catch (error) {
    logRecoverableError(request, error);
    fatalError(request, error);
  }
}

// This is called to early terminate a request. It creates an error at all pending tasks.
export function abort(request         , reason       )       {
  try {
    const abortableTasks = request.abortableTasks;
    if (abortableTasks.size > 0) {
      // We have tasks to abort. We'll emit one error row and then emit a reference
      // to that row from every row that's still remaining.
      const error =
        reason === undefined
          ? new Error('The render was aborted by the server without a reason.')
          : reason;

      const digest = logRecoverableError(request, error);
      request.pendingChunks++;
      const errorId = request.nextChunkId++;
      if (__DEV__) {
        const {message, stack} = getErrorMessageAndStackDev(error);
        emitErrorChunkDev(request, errorId, digest, message, stack);
      } else {
        emitErrorChunkProd(request, errorId, digest);
      }
      abortableTasks.forEach(task => abortTask(task, request, errorId));
      abortableTasks.clear();
    }
    if (request.destination !== null) {
      flushCompletedChunks(request, request.destination);
    }
  } catch (error) {
    logRecoverableError(request, error);
    fatalError(request, error);
  }
}

function importServerContexts(
  contexts                                          ,
) {
  if (contexts) {
    const prevContext = getActiveContext();
    switchContext(rootContextSnapshot);
    for (let i = 0; i < contexts.length; i++) {
      const [name, value] = contexts[i];
      const context = getOrCreateServerContext(name);
      pushProvider(context, value);
    }
    const importedContext = getActiveContext();
    switchContext(prevContext);
    return importedContext;
  }
  return rootContextSnapshot;
}

function serializeRowHeader(tag        , id        ) {
  return id.toString(16) + ':' + tag;
}

function processErrorChunkProd(
  request         ,
  id        ,
  digest        ,
)        {
  if (__DEV__) {
    // These errors should never make it into a build so we don't need to encode them in codes.json
    // eslint-disable-next-line react-internal/prod-error-codes
    throw new Error(
      'processErrorChunkProd should never be called while in development mode. Use processErrorChunkDev instead. This is a bug in React.',
    );
  }

  const errorInfo      = {digest};
  const row = serializeRowHeader('E', id) + stringify(errorInfo) + '\n';
  return stringToChunk(row);
}

function processErrorChunkDev(
  request         ,
  id        ,
  digest        ,
  message        ,
  stack        ,
)        {
  if (!__DEV__) {
    // These errors should never make it into a build so we don't need to encode them in codes.json
    // eslint-disable-next-line react-internal/prod-error-codes
    throw new Error(
      'processErrorChunkDev should never be called while in production mode. Use processErrorChunkProd instead. This is a bug in React.',
    );
  }

  const errorInfo      = {digest, message, stack};
  const row = serializeRowHeader('E', id) + stringify(errorInfo) + '\n';
  return stringToChunk(row);
}

function processModelChunk(
  request         ,
  id        ,
  model                  ,
)        {
  // $FlowFixMe[incompatible-type] stringify can return null
  const json         = stringify(model, request.toJSON);
  const row = id.toString(16) + ':' + json + '\n';
  return stringToChunk(row);
}

function processReferenceChunk(
  request         ,
  id        ,
  reference        ,
)        {
  const json = stringify(reference);
  const row = id.toString(16) + ':' + json + '\n';
  return stringToChunk(row);
}

function processImportChunk(
  request         ,
  id        ,
  clientReferenceMetadata                  ,
)        {
  // $FlowFixMe[incompatible-type] stringify can return null
  const json         = stringify(clientReferenceMetadata);
  const row = serializeRowHeader('I', id) + json + '\n';
  return stringToChunk(row);
}

function processHintChunk(
  request         ,
  id        ,
  code        ,
  model           ,
)        {
  const json         = stringify(model);
  const row = serializeRowHeader('H' + code, id) + json + '\n';
  return stringToChunk(row);
}

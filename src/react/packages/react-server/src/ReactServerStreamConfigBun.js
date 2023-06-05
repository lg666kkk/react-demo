/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *      
 */

                                                               
               
                           
                            
  
                                                      

                                      
                                  

export function scheduleWork(callback            ) {
  callback();
}

export function flushBuffered(destination             ) {
  // WHATWG Streams do not yet have a way to flush the underlying
  // transform streams. https://github.com/whatwg/streams/issues/960
}

export function beginWriting(destination             ) {}

export function writeChunk(
  destination             ,
  chunk                          ,
)       {
  if (chunk.length === 0) {
    return;
  }

  destination.write(chunk);
}

export function writeChunkAndReturn(
  destination             ,
  chunk                          ,
)          {
  return !!destination.write(chunk);
}

export function completeWriting(destination             ) {}

export function close(destination             ) {
  destination.end();
}

export function stringToChunk(content        )        {
  return content;
}

export function stringToPrecomputedChunk(content        )                   {
  return content;
}

export function clonePrecomputedChunk(
  chunk                  ,
)                   {
  return chunk;
}

export function closeWithError(destination             , error       )       {
  if (typeof destination.error === 'function') {
    // $FlowFixMe[incompatible-call]: This is an Error object or the destination accepts other types.
    destination.error(error);
  } else {
    // Earlier implementations doesn't support this method. In that environment you're
    // supposed to throw from a promise returned but we don't return a promise in our
    // approach. We could fork this implementation but this is environment is an edge
    // case to begin with. It's even less common to run this in an older environment.
    // Even then, this is not where errors are supposed to happen and they get reported
    // to a global callback in addition to this anyway. So it's fine just to close this.
    destination.close();
  }
}

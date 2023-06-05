/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *      
 */

                                                                         

                                     // base URL on the file system

                                                
                   
               
                                          
  

                                       

// eslint-disable-next-line no-unused-vars
                                  
                   
               
  

                                       
                        
                        
  

                                        

const CLIENT_REFERENCE_TAG = Symbol.for('react.client.reference');
const SERVER_REFERENCE_TAG = Symbol.for('react.server.reference');

export function getClientReferenceKey(
  reference                      ,
)                     {
  return reference.$$id;
}

export function isClientReference(reference        )          {
  return reference.$$typeof === CLIENT_REFERENCE_TAG;
}

export function isServerReference(reference        )          {
  return reference.$$typeof === SERVER_REFERENCE_TAG;
}

export function resolveClientReferenceMetadata   (
  config                ,
  clientReference                    ,
)                          {
  const baseURL         = config;
  const id = clientReference.$$id;
  const idx = id.lastIndexOf('#');
  const exportName = id.slice(idx + 1);
  const fullURL = id.slice(0, idx);
  if (!fullURL.startsWith(baseURL)) {
    throw new Error(
      'Attempted to load a Client Module outside the hosted root.',
    );
  }
  // Relative URL
  const modulePath = fullURL.slice(baseURL.length);
  return [modulePath, exportName];
}

export function getServerReferenceId   (
  config                ,
  serverReference                    ,
)                    {
  return serverReference.$$id;
}

export function getServerReferenceBoundArguments   (
  config                ,
  serverReference                    ,
)                                 {
  return serverReference.$$bound;
}

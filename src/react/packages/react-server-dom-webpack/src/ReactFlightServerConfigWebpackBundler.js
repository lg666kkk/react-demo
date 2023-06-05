/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *      
 */

                                                                         

                              
                                        
  

                                                
                   
               
                                          
  

                                       

// eslint-disable-next-line no-unused-vars
                                  
                   
               
                   
  

                                       
             
                        
               
                 
  

                                        

const CLIENT_REFERENCE_TAG = Symbol.for('react.client.reference');
const SERVER_REFERENCE_TAG = Symbol.for('react.server.reference');

export function getClientReferenceKey(
  reference                      ,
)                     {
  return reference.$$async ? reference.$$id + '#async' : reference.$$id;
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
  const modulePath = clientReference.$$id;
  let name = '';
  let resolvedModuleData = config[modulePath];
  if (resolvedModuleData) {
    // The potentially aliased name.
    name = resolvedModuleData.name;
  } else {
    // We didn't find this specific export name but we might have the * export
    // which contains this name as well.
    // TODO: It's unfortunate that we now have to parse this string. We should
    // probably go back to encoding path and name separately on the client reference.
    const idx = modulePath.lastIndexOf('#');
    if (idx !== -1) {
      name = modulePath.slice(idx + 1);
      resolvedModuleData = config[modulePath.slice(0, idx)];
    }
    if (!resolvedModuleData) {
      throw new Error(
        'Could not find the module "' +
          modulePath +
          '" in the React Client Manifest. ' +
          'This is probably a bug in the React Server Components bundler.',
      );
    }
  }
  return {
    id: resolvedModuleData.id,
    chunks: resolvedModuleData.chunks,
    name: name,
    async: !!clientReference.$$async,
  };
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

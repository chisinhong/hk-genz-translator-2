import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'example',
  service: 'hk-genz-translator-2',
  location: 'us-central1'
};

export const addSlangTermRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddSlangTerm');
}
addSlangTermRef.operationName = 'AddSlangTerm';

export function addSlangTerm(dc) {
  return executeMutation(addSlangTermRef(dc));
}

export const getSlangTermsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSlangTerms');
}
getSlangTermsRef.operationName = 'GetSlangTerms';

export function getSlangTerms(dc) {
  return executeQuery(getSlangTermsRef(dc));
}

export const addFavoriteSlangRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddFavoriteSlang', inputVars);
}
addFavoriteSlangRef.operationName = 'AddFavoriteSlang';

export function addFavoriteSlang(dcOrVars, vars) {
  return executeMutation(addFavoriteSlangRef(dcOrVars, vars));
}

export const getMySubmissionsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMySubmissions');
}
getMySubmissionsRef.operationName = 'GetMySubmissions';

export function getMySubmissions(dc) {
  return executeQuery(getMySubmissionsRef(dc));
}


const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'example',
  service: 'hk-genz-translator-2',
  location: 'us-central1'
};
exports.connectorConfig = connectorConfig;

const addSlangTermRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddSlangTerm');
}
addSlangTermRef.operationName = 'AddSlangTerm';
exports.addSlangTermRef = addSlangTermRef;

exports.addSlangTerm = function addSlangTerm(dc) {
  return executeMutation(addSlangTermRef(dc));
};

const getSlangTermsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSlangTerms');
}
getSlangTermsRef.operationName = 'GetSlangTerms';
exports.getSlangTermsRef = getSlangTermsRef;

exports.getSlangTerms = function getSlangTerms(dc) {
  return executeQuery(getSlangTermsRef(dc));
};

const addFavoriteSlangRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddFavoriteSlang', inputVars);
}
addFavoriteSlangRef.operationName = 'AddFavoriteSlang';
exports.addFavoriteSlangRef = addFavoriteSlangRef;

exports.addFavoriteSlang = function addFavoriteSlang(dcOrVars, vars) {
  return executeMutation(addFavoriteSlangRef(dcOrVars, vars));
};

const getMySubmissionsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMySubmissions');
}
getMySubmissionsRef.operationName = 'GetMySubmissions';
exports.getMySubmissionsRef = getMySubmissionsRef;

exports.getMySubmissions = function getMySubmissions(dc) {
  return executeQuery(getMySubmissionsRef(dc));
};

# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetSlangTerms*](#getslangterms)
  - [*GetMySubmissions*](#getmysubmissions)
- [**Mutations**](#mutations)
  - [*AddSlangTerm*](#addslangterm)
  - [*AddFavoriteSlang*](#addfavoriteslang)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetSlangTerms
You can execute the `GetSlangTerms` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getSlangTerms(): QueryPromise<GetSlangTermsData, undefined>;

interface GetSlangTermsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetSlangTermsData, undefined>;
}
export const getSlangTermsRef: GetSlangTermsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getSlangTerms(dc: DataConnect): QueryPromise<GetSlangTermsData, undefined>;

interface GetSlangTermsRef {
  ...
  (dc: DataConnect): QueryRef<GetSlangTermsData, undefined>;
}
export const getSlangTermsRef: GetSlangTermsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getSlangTermsRef:
```typescript
const name = getSlangTermsRef.operationName;
console.log(name);
```

### Variables
The `GetSlangTerms` query has no variables.
### Return Type
Recall that executing the `GetSlangTerms` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetSlangTermsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetSlangTermsData {
  slangTerms: ({
    id: UUIDString;
    cantonesePhrase: string;
    englishTranslation: string;
  } & SlangTerm_Key)[];
}
```
### Using `GetSlangTerms`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getSlangTerms } from '@dataconnect/generated';


// Call the `getSlangTerms()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getSlangTerms();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getSlangTerms(dataConnect);

console.log(data.slangTerms);

// Or, you can use the `Promise` API.
getSlangTerms().then((response) => {
  const data = response.data;
  console.log(data.slangTerms);
});
```

### Using `GetSlangTerms`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getSlangTermsRef } from '@dataconnect/generated';


// Call the `getSlangTermsRef()` function to get a reference to the query.
const ref = getSlangTermsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getSlangTermsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.slangTerms);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.slangTerms);
});
```

## GetMySubmissions
You can execute the `GetMySubmissions` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getMySubmissions(): QueryPromise<GetMySubmissionsData, undefined>;

interface GetMySubmissionsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMySubmissionsData, undefined>;
}
export const getMySubmissionsRef: GetMySubmissionsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getMySubmissions(dc: DataConnect): QueryPromise<GetMySubmissionsData, undefined>;

interface GetMySubmissionsRef {
  ...
  (dc: DataConnect): QueryRef<GetMySubmissionsData, undefined>;
}
export const getMySubmissionsRef: GetMySubmissionsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getMySubmissionsRef:
```typescript
const name = getMySubmissionsRef.operationName;
console.log(name);
```

### Variables
The `GetMySubmissions` query has no variables.
### Return Type
Recall that executing the `GetMySubmissions` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetMySubmissionsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetMySubmissionsData {
  submissions: ({
    id: UUIDString;
    cantonesePhrase: string;
    englishTranslation: string;
    exampleUsage?: string | null;
    status: string;
  } & Submission_Key)[];
}
```
### Using `GetMySubmissions`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getMySubmissions } from '@dataconnect/generated';


// Call the `getMySubmissions()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getMySubmissions();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getMySubmissions(dataConnect);

console.log(data.submissions);

// Or, you can use the `Promise` API.
getMySubmissions().then((response) => {
  const data = response.data;
  console.log(data.submissions);
});
```

### Using `GetMySubmissions`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getMySubmissionsRef } from '@dataconnect/generated';


// Call the `getMySubmissionsRef()` function to get a reference to the query.
const ref = getMySubmissionsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getMySubmissionsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.submissions);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.submissions);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## AddSlangTerm
You can execute the `AddSlangTerm` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
addSlangTerm(): MutationPromise<AddSlangTermData, undefined>;

interface AddSlangTermRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<AddSlangTermData, undefined>;
}
export const addSlangTermRef: AddSlangTermRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
addSlangTerm(dc: DataConnect): MutationPromise<AddSlangTermData, undefined>;

interface AddSlangTermRef {
  ...
  (dc: DataConnect): MutationRef<AddSlangTermData, undefined>;
}
export const addSlangTermRef: AddSlangTermRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the addSlangTermRef:
```typescript
const name = addSlangTermRef.operationName;
console.log(name);
```

### Variables
The `AddSlangTerm` mutation has no variables.
### Return Type
Recall that executing the `AddSlangTerm` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AddSlangTermData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AddSlangTermData {
  slangTerm_insert: SlangTerm_Key;
}
```
### Using `AddSlangTerm`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, addSlangTerm } from '@dataconnect/generated';


// Call the `addSlangTerm()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await addSlangTerm();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await addSlangTerm(dataConnect);

console.log(data.slangTerm_insert);

// Or, you can use the `Promise` API.
addSlangTerm().then((response) => {
  const data = response.data;
  console.log(data.slangTerm_insert);
});
```

### Using `AddSlangTerm`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, addSlangTermRef } from '@dataconnect/generated';


// Call the `addSlangTermRef()` function to get a reference to the mutation.
const ref = addSlangTermRef();

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = addSlangTermRef(dataConnect);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.slangTerm_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.slangTerm_insert);
});
```

## AddFavoriteSlang
You can execute the `AddFavoriteSlang` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
addFavoriteSlang(vars: AddFavoriteSlangVariables): MutationPromise<AddFavoriteSlangData, AddFavoriteSlangVariables>;

interface AddFavoriteSlangRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddFavoriteSlangVariables): MutationRef<AddFavoriteSlangData, AddFavoriteSlangVariables>;
}
export const addFavoriteSlangRef: AddFavoriteSlangRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
addFavoriteSlang(dc: DataConnect, vars: AddFavoriteSlangVariables): MutationPromise<AddFavoriteSlangData, AddFavoriteSlangVariables>;

interface AddFavoriteSlangRef {
  ...
  (dc: DataConnect, vars: AddFavoriteSlangVariables): MutationRef<AddFavoriteSlangData, AddFavoriteSlangVariables>;
}
export const addFavoriteSlangRef: AddFavoriteSlangRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the addFavoriteSlangRef:
```typescript
const name = addFavoriteSlangRef.operationName;
console.log(name);
```

### Variables
The `AddFavoriteSlang` mutation requires an argument of type `AddFavoriteSlangVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AddFavoriteSlangVariables {
  slangTermId: UUIDString;
}
```
### Return Type
Recall that executing the `AddFavoriteSlang` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AddFavoriteSlangData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AddFavoriteSlangData {
  favoriteSlang_insert: FavoriteSlang_Key;
}
```
### Using `AddFavoriteSlang`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, addFavoriteSlang, AddFavoriteSlangVariables } from '@dataconnect/generated';

// The `AddFavoriteSlang` mutation requires an argument of type `AddFavoriteSlangVariables`:
const addFavoriteSlangVars: AddFavoriteSlangVariables = {
  slangTermId: ..., 
};

// Call the `addFavoriteSlang()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await addFavoriteSlang(addFavoriteSlangVars);
// Variables can be defined inline as well.
const { data } = await addFavoriteSlang({ slangTermId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await addFavoriteSlang(dataConnect, addFavoriteSlangVars);

console.log(data.favoriteSlang_insert);

// Or, you can use the `Promise` API.
addFavoriteSlang(addFavoriteSlangVars).then((response) => {
  const data = response.data;
  console.log(data.favoriteSlang_insert);
});
```

### Using `AddFavoriteSlang`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, addFavoriteSlangRef, AddFavoriteSlangVariables } from '@dataconnect/generated';

// The `AddFavoriteSlang` mutation requires an argument of type `AddFavoriteSlangVariables`:
const addFavoriteSlangVars: AddFavoriteSlangVariables = {
  slangTermId: ..., 
};

// Call the `addFavoriteSlangRef()` function to get a reference to the mutation.
const ref = addFavoriteSlangRef(addFavoriteSlangVars);
// Variables can be defined inline as well.
const ref = addFavoriteSlangRef({ slangTermId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = addFavoriteSlangRef(dataConnect, addFavoriteSlangVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.favoriteSlang_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.favoriteSlang_insert);
});
```


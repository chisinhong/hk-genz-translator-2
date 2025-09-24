import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface AddFavoriteSlangData {
  favoriteSlang_insert: FavoriteSlang_Key;
}

export interface AddFavoriteSlangVariables {
  slangTermId: UUIDString;
}

export interface AddSlangTermData {
  slangTerm_insert: SlangTerm_Key;
}

export interface FavoriteSlang_Key {
  userId: UUIDString;
  slangTermId: UUIDString;
  __typename?: 'FavoriteSlang_Key';
}

export interface GetMySubmissionsData {
  submissions: ({
    id: UUIDString;
    cantonesePhrase: string;
    englishTranslation: string;
    exampleUsage?: string | null;
    status: string;
  } & Submission_Key)[];
}

export interface GetSlangTermsData {
  slangTerms: ({
    id: UUIDString;
    cantonesePhrase: string;
    englishTranslation: string;
  } & SlangTerm_Key)[];
}

export interface SlangTerm_Key {
  id: UUIDString;
  __typename?: 'SlangTerm_Key';
}

export interface Submission_Key {
  id: UUIDString;
  __typename?: 'Submission_Key';
}

export interface Translation_Key {
  id: UUIDString;
  __typename?: 'Translation_Key';
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface AddSlangTermRef {
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<AddSlangTermData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): MutationRef<AddSlangTermData, undefined>;
  operationName: string;
}
export const addSlangTermRef: AddSlangTermRef;

export function addSlangTerm(): MutationPromise<AddSlangTermData, undefined>;
export function addSlangTerm(dc: DataConnect): MutationPromise<AddSlangTermData, undefined>;

interface GetSlangTermsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetSlangTermsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetSlangTermsData, undefined>;
  operationName: string;
}
export const getSlangTermsRef: GetSlangTermsRef;

export function getSlangTerms(): QueryPromise<GetSlangTermsData, undefined>;
export function getSlangTerms(dc: DataConnect): QueryPromise<GetSlangTermsData, undefined>;

interface AddFavoriteSlangRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddFavoriteSlangVariables): MutationRef<AddFavoriteSlangData, AddFavoriteSlangVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AddFavoriteSlangVariables): MutationRef<AddFavoriteSlangData, AddFavoriteSlangVariables>;
  operationName: string;
}
export const addFavoriteSlangRef: AddFavoriteSlangRef;

export function addFavoriteSlang(vars: AddFavoriteSlangVariables): MutationPromise<AddFavoriteSlangData, AddFavoriteSlangVariables>;
export function addFavoriteSlang(dc: DataConnect, vars: AddFavoriteSlangVariables): MutationPromise<AddFavoriteSlangData, AddFavoriteSlangVariables>;

interface GetMySubmissionsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMySubmissionsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetMySubmissionsData, undefined>;
  operationName: string;
}
export const getMySubmissionsRef: GetMySubmissionsRef;

export function getMySubmissions(): QueryPromise<GetMySubmissionsData, undefined>;
export function getMySubmissions(dc: DataConnect): QueryPromise<GetMySubmissionsData, undefined>;


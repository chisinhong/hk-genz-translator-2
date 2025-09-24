import { AddSlangTermData, GetSlangTermsData, AddFavoriteSlangData, AddFavoriteSlangVariables, GetMySubmissionsData } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useAddSlangTerm(options?: useDataConnectMutationOptions<AddSlangTermData, FirebaseError, void>): UseDataConnectMutationResult<AddSlangTermData, undefined>;
export function useAddSlangTerm(dc: DataConnect, options?: useDataConnectMutationOptions<AddSlangTermData, FirebaseError, void>): UseDataConnectMutationResult<AddSlangTermData, undefined>;

export function useGetSlangTerms(options?: useDataConnectQueryOptions<GetSlangTermsData>): UseDataConnectQueryResult<GetSlangTermsData, undefined>;
export function useGetSlangTerms(dc: DataConnect, options?: useDataConnectQueryOptions<GetSlangTermsData>): UseDataConnectQueryResult<GetSlangTermsData, undefined>;

export function useAddFavoriteSlang(options?: useDataConnectMutationOptions<AddFavoriteSlangData, FirebaseError, AddFavoriteSlangVariables>): UseDataConnectMutationResult<AddFavoriteSlangData, AddFavoriteSlangVariables>;
export function useAddFavoriteSlang(dc: DataConnect, options?: useDataConnectMutationOptions<AddFavoriteSlangData, FirebaseError, AddFavoriteSlangVariables>): UseDataConnectMutationResult<AddFavoriteSlangData, AddFavoriteSlangVariables>;

export function useGetMySubmissions(options?: useDataConnectQueryOptions<GetMySubmissionsData>): UseDataConnectQueryResult<GetMySubmissionsData, undefined>;
export function useGetMySubmissions(dc: DataConnect, options?: useDataConnectQueryOptions<GetMySubmissionsData>): UseDataConnectQueryResult<GetMySubmissionsData, undefined>;

import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface AuthCanister {
  'complete_authorize' : ActorMethod<[string], Result>,
  'complete_payment_setup' : ActorMethod<[string], Result_5>,
  'confirm_login' : ActorMethod<[string], Result_4>,
  'delete_resource_server' : ActorMethod<[string], Result>,
  'deny_consent' : ActorMethod<[string], Result>,
  'get_my_resource_server_details' : ActorMethod<[string], Result_1>,
  'get_session_info' : ActorMethod<[string], Result_3>,
  'http_request' : ActorMethod<[HttpRequest], HttpResponse>,
  'http_request_update' : ActorMethod<[HttpRequest], HttpResponse>,
  'list_my_resource_servers' : ActorMethod<[], Result_2>,
  'register_resource_server' : ActorMethod<
    [RegisterResourceServerArgs],
    Result_1
  >,
  'set_frontend_canister_id' : ActorMethod<[Principal], undefined>,
  'update_resource_server' : ActorMethod<[UpdateResourceServerArgs], Result>,
}
export type AuthFlowStep = { 'consent' : null } |
  { 'setup' : null };
export interface CallbackStrategy {
  'token' : Token,
  'callback' : [Principal, string],
}
export interface ConsentData {
  'scopes' : Array<ScopeData>,
  'client_name' : string,
  'logo_uri' : string,
}
export type HeaderField = [string, string];
export interface HttpRequest {
  'url' : string,
  'method' : string,
  'body' : Uint8Array | number[],
  'headers' : Array<HeaderField>,
}
export interface HttpResponse {
  'body' : Uint8Array | number[],
  'headers' : Array<HeaderField>,
  'upgrade' : [] | [boolean],
  'streaming_strategy' : [] | [StreamingStrategy],
  'status_code' : number,
}
export interface LoginConfirmation {
  'next_step' : AuthFlowStep,
  'accepted_payment_canisters' : Array<Principal>,
  'consent_data' : ConsentData,
}
export interface RegisterResourceServerArgs {
  'initial_service_principal' : Principal,
  'scopes' : Array<[string, string]>,
  'name' : string,
  'uris' : Array<string>,
  'accepted_payment_canisters' : Array<Principal>,
  'logo_uri' : string,
}
export interface ResourceServer {
  'status' : { 'active' : null } |
    { 'pending' : null },
  'resource_server_id' : string,
  'owner' : Principal,
  'scopes' : Array<[string, string]>,
  'name' : string,
  'uris' : Array<string>,
  'accepted_payment_canisters' : Array<Principal>,
  'logo_uri' : string,
  'service_principals' : Array<Principal>,
}
export type Result = { 'ok' : string } |
  { 'err' : string };
export type Result_1 = { 'ok' : ResourceServer } |
  { 'err' : string };
export type Result_2 = { 'ok' : Array<ResourceServer> } |
  { 'err' : string };
export type Result_3 = { 'ok' : SessionInfo } |
  { 'err' : string };
export type Result_4 = { 'ok' : LoginConfirmation } |
  { 'err' : string };
export type Result_5 = { 'ok' : null } |
  { 'err' : string };
export interface ScopeData { 'id' : string, 'description' : string }
export interface SessionInfo {
  'resource_server_principal' : Principal,
  'client_name' : string,
}
export interface StreamingCallbackHttpResponse {
  'token' : [] | [Token],
  'body' : Uint8Array | number[],
}
export type StreamingStrategy = { 'Callback' : CallbackStrategy };
export interface Token { 'arbitrary_data' : string }
export interface UpdateResourceServerArgs {
  'resource_server_id' : string,
  'scopes' : [] | [Array<[string, string]>],
  'name' : [] | [string],
  'uris' : [] | [Array<string>],
  'accepted_payment_canisters' : [] | [Array<Principal>],
  'logo_uri' : [] | [string],
  'service_principals' : [] | [Array<Principal>],
}
export interface _SERVICE extends AuthCanister {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];

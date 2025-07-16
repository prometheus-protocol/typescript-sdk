import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface AuthCanister {
  'activate_client' : ActorMethod<[string, string], Result_1>,
  'add_test_client' : ActorMethod<[Client], undefined>,
  'charge_user' : ActorMethod<[Principal, bigint], Result_2>,
  'complete_authorize' : ActorMethod<[string, Principal], Result_1>,
  'get_subscription' : ActorMethod<[], [] | [Subscription]>,
  'http_request' : ActorMethod<[HttpRequest], HttpResponse>,
  'http_request_update' : ActorMethod<[HttpRequest], HttpResponse>,
  'register_resource_server' : ActorMethod<
    [string, Principal, Principal],
    ResourceServer
  >,
  'register_subscription' : ActorMethod<[], Result>,
  'set_frontend_canister_id' : ActorMethod<[Principal], undefined>,
}
export interface CallbackStrategy {
  'token' : Token,
  'callback' : [Principal, string],
}
export interface Client {
  'status' : { 'active' : null } |
    { 'pending_activation' : null },
  'client_secret_hash' : string,
  'redirect_uris' : Array<string>,
  'owner' : Principal,
  'client_name' : string,
  'logo_uri' : string,
  'client_id' : string,
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
export interface ResourceServer {
  'status' : { 'active' : null } |
    { 'pending' : null },
  'resource_server_id' : string,
  'owner' : Principal,
  'name' : string,
  'service_principals' : Array<Principal>,
  'payout_principal' : Principal,
}
export type Result = { 'ok' : Subscription } |
  { 'err' : string };
export type Result_1 = { 'ok' : string } |
  { 'err' : string };
export type Result_2 = { 'ok' : null } |
  { 'err' : string };
export interface StreamingCallbackHttpResponse {
  'token' : [] | [Token],
  'body' : Uint8Array | number[],
}
export type StreamingStrategy = { 'Callback' : CallbackStrategy };
export interface Subscription {
  'user_principal' : Principal,
  'tier' : string,
  'expires_at' : Time,
}
export type Time = bigint;
export interface Token { 'arbitrary_data' : string }
export interface _SERVICE extends AuthCanister {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];

import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface AuthCanister {
  'add_test_client' : ActorMethod<[Client], undefined>,
  'charge_user' : ActorMethod<[ChargeUserArgs], Result_1>,
  'complete_authorize' : ActorMethod<[string], Result>,
  'http_request' : ActorMethod<[HttpRequest], HttpResponse>,
  'http_request_update' : ActorMethod<[HttpRequest], HttpResponse>,
  'register_resource_server' : ActorMethod<
    [RegisterResourceServerArgs],
    ResourceServer
  >,
  'set_frontend_canister_id' : ActorMethod<[Principal], undefined>,
  'update_resource_server_uris' : ActorMethod<
    [UpdateResourceServerUrisArgs],
    Result
  >,
}
export interface CallbackStrategy {
  'token' : Token,
  'callback' : [Principal, string],
}
export interface ChargeUserArgs {
  'user_to_charge' : Principal,
  'amount' : bigint,
  'icrc2_ledger_id' : Principal,
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
export interface RegisterResourceServerArgs {
  'initial_service_principal' : Principal,
  'name' : string,
  'uris' : Array<string>,
  'payout_principal' : Principal,
}
export interface ResourceServer {
  'status' : { 'active' : null } |
    { 'pending' : null },
  'resource_server_id' : string,
  'owner' : Principal,
  'name' : string,
  'uris' : Array<string>,
  'service_principals' : Array<Principal>,
  'payout_principal' : Principal,
}
export type Result = { 'ok' : string } |
  { 'err' : string };
export type Result_1 = { 'ok' : null } |
  { 'err' : string };
export interface StreamingCallbackHttpResponse {
  'token' : [] | [Token],
  'body' : Uint8Array | number[],
}
export type StreamingStrategy = { 'Callback' : CallbackStrategy };
export interface Token { 'arbitrary_data' : string }
export interface UpdateResourceServerUrisArgs {
  'resource_server_id' : string,
  'new_uris' : Array<string>,
}
export interface _SERVICE extends AuthCanister {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];

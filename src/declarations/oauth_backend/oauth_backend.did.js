export const idlFactory = ({ IDL }) => {
  const Client = IDL.Record({
    'status' : IDL.Variant({
      'active' : IDL.Null,
      'pending_activation' : IDL.Null,
    }),
    'client_secret_hash' : IDL.Text,
    'redirect_uris' : IDL.Vec(IDL.Text),
    'owner' : IDL.Principal,
    'client_name' : IDL.Text,
    'logo_uri' : IDL.Text,
    'client_id' : IDL.Text,
  });
  const ChargeUserArgs = IDL.Record({
    'user_to_charge' : IDL.Principal,
    'amount' : IDL.Nat,
    'icrc2_ledger_id' : IDL.Principal,
  });
  const Result_1 = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const Result = IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text });
  const HeaderField = IDL.Tuple(IDL.Text, IDL.Text);
  const HttpRequest = IDL.Record({
    'url' : IDL.Text,
    'method' : IDL.Text,
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(HeaderField),
  });
  const Token = IDL.Record({ 'arbitrary_data' : IDL.Text });
  const StreamingCallbackHttpResponse = IDL.Record({
    'token' : IDL.Opt(Token),
    'body' : IDL.Vec(IDL.Nat8),
  });
  const CallbackStrategy = IDL.Record({
    'token' : Token,
    'callback' : IDL.Func([Token], [StreamingCallbackHttpResponse], ['query']),
  });
  const StreamingStrategy = IDL.Variant({ 'Callback' : CallbackStrategy });
  const HttpResponse = IDL.Record({
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(HeaderField),
    'upgrade' : IDL.Opt(IDL.Bool),
    'streaming_strategy' : IDL.Opt(StreamingStrategy),
    'status_code' : IDL.Nat16,
  });
  const RegisterResourceServerArgs = IDL.Record({
    'initial_service_principal' : IDL.Principal,
    'name' : IDL.Text,
    'uris' : IDL.Vec(IDL.Text),
    'payout_principal' : IDL.Principal,
  });
  const ResourceServer = IDL.Record({
    'status' : IDL.Variant({ 'active' : IDL.Null, 'pending' : IDL.Null }),
    'resource_server_id' : IDL.Text,
    'owner' : IDL.Principal,
    'name' : IDL.Text,
    'uris' : IDL.Vec(IDL.Text),
    'service_principals' : IDL.Vec(IDL.Principal),
    'payout_principal' : IDL.Principal,
  });
  const UpdateResourceServerUrisArgs = IDL.Record({
    'resource_server_id' : IDL.Text,
    'new_uris' : IDL.Vec(IDL.Text),
  });
  const AuthCanister = IDL.Service({
    'add_test_client' : IDL.Func([Client], [], ['oneway']),
    'charge_user' : IDL.Func([ChargeUserArgs], [Result_1], []),
    'complete_authorize' : IDL.Func([IDL.Text], [Result], []),
    'http_request' : IDL.Func([HttpRequest], [HttpResponse], ['query']),
    'http_request_update' : IDL.Func([HttpRequest], [HttpResponse], []),
    'register_resource_server' : IDL.Func(
        [RegisterResourceServerArgs],
        [ResourceServer],
        [],
      ),
    'set_frontend_canister_id' : IDL.Func([IDL.Principal], [], ['oneway']),
    'update_resource_server_uris' : IDL.Func(
        [UpdateResourceServerUrisArgs],
        [Result],
        [],
      ),
  });
  return AuthCanister;
};
export const init = ({ IDL }) => { return []; };

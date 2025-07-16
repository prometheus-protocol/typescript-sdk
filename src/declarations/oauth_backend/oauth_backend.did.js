export const idlFactory = ({ IDL }) => {
  const Result_1 = IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text });
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
  const Result_2 = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const Time = IDL.Int;
  const Subscription = IDL.Record({
    'user_principal' : IDL.Principal,
    'tier' : IDL.Text,
    'expires_at' : Time,
  });
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
  const ResourceServer = IDL.Record({
    'status' : IDL.Variant({ 'active' : IDL.Null, 'pending' : IDL.Null }),
    'resource_server_id' : IDL.Text,
    'owner' : IDL.Principal,
    'name' : IDL.Text,
    'service_principals' : IDL.Vec(IDL.Principal),
    'payout_principal' : IDL.Principal,
  });
  const Result = IDL.Variant({ 'ok' : Subscription, 'err' : IDL.Text });
  const AuthCanister = IDL.Service({
    'activate_client' : IDL.Func([IDL.Text, IDL.Text], [Result_1], []),
    'add_test_client' : IDL.Func([Client], [], ['oneway']),
    'charge_user' : IDL.Func([IDL.Principal, IDL.Nat], [Result_2], []),
    'complete_authorize' : IDL.Func([IDL.Text, IDL.Principal], [Result_1], []),
    'get_subscription' : IDL.Func([], [IDL.Opt(Subscription)], ['query']),
    'http_request' : IDL.Func([HttpRequest], [HttpResponse], ['query']),
    'http_request_update' : IDL.Func([HttpRequest], [HttpResponse], []),
    'register_resource_server' : IDL.Func(
        [IDL.Text, IDL.Principal, IDL.Principal],
        [ResourceServer],
        [],
      ),
    'register_subscription' : IDL.Func([], [Result], []),
    'set_frontend_canister_id' : IDL.Func([IDL.Principal], [], ['oneway']),
  });
  return AuthCanister;
};
export const init = ({ IDL }) => { return [IDL.Principal]; };

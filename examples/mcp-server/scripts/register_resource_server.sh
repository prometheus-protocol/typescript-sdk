# Replace placeholders with your actual values
dfx canister call --ic bfggx-7yaaa-aaaai-q32gq-cai register_resource_server '(record { 
  name = "Super Sneakers";
  initial_service_principal = principal "jmjyx-d5aic-g6lug-uhffn-aiuid-pp3wo-mh2d7-oegrk-jrlog-eaqr5-eqe";
  logo_uri = "https://placehold.co/128x128/1a1a1a/ffffff/png?text=Super+Sneakers";
  uris = vec { "http://localhost:3000" };
  accepted_payment_canisters = vec { principal "cngnf-vqaaa-aaaar-qag4q-cai" };
  scopes = vec { }
})'
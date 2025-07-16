# Replace placeholders with your actual values
dfx canister call avqkn-guaaa-aaaaa-qaaea-cai register_resource_server '(record { 
  name = "Test SDK Server";
  initial_service_principal = principal "jmjyx-d5aic-g6lug-uhffn-aiuid-pp3wo-mh2d7-oegrk-jrlog-eaqr5-eqe";
  payout_principal = principal "jmjyx-d5aic-g6lug-uhffn-aiuid-pp3wo-mh2d7-oegrk-jrlog-eaqr5-eqe";
  uris = vec { "http://localhost:8079" }; 
})'
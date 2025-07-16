# Switch to the user's identity
dfx identity use default 
# Replace placeholders
dfx canister call icrc2_ledger icrc2_approve \
  '(record { spender=record { owner=principal "your-auth-canister-id" }; amount=10000000000 })'
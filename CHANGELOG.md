## [1.2.5](https://github.com/prometheus-protocol/typescript-sdk/compare/v1.2.4...v1.2.5) (2025-07-25)


### Bug Fixes

* remove expiration check so middleware can handle it ([d1eab78](https://github.com/prometheus-protocol/typescript-sdk/commit/d1eab785095e8e91b4fe500ebd66add2bd7578dd))

## [1.2.4](https://github.com/prometheus-protocol/typescript-sdk/compare/v1.2.3...v1.2.4) (2025-07-24)


### Bug Fixes

* add caching to jwk fetching ([a81ff65](https://github.com/prometheus-protocol/typescript-sdk/commit/a81ff65cf4f51c7977cb57c424faeaff36facb7f))

## [1.2.3](https://github.com/prometheus-protocol/typescript-sdk/compare/v1.2.2...v1.2.3) (2025-07-24)


### Bug Fixes

* throw the correct error to trigger oauth refresh ([29b4266](https://github.com/prometheus-protocol/typescript-sdk/commit/29b4266377a673a80a11deeab96f87cc3d7c4282))

## [1.2.2](https://github.com/prometheus-protocol/typescript-sdk/compare/v1.2.1...v1.2.2) (2025-07-24)


### Bug Fixes

* add dashboard url to insufficient funds or allowance error strings ([25e5d2f](https://github.com/prometheus-protocol/typescript-sdk/commit/25e5d2f68212d615fd35490f6ab8578d7702cd8e))

## [1.2.1](https://github.com/prometheus-protocol/typescript-sdk/compare/v1.2.0...v1.2.1) (2025-07-24)


### Bug Fixes

* remove unused subaccount from sdk ([edd41f1](https://github.com/prometheus-protocol/typescript-sdk/commit/edd41f1e8cec18328e7f984d2231608183d70555))

# [1.2.0](https://github.com/prometheus-protocol/typescript-sdk/compare/v1.1.0...v1.2.0) (2025-07-24)


### Features

* add get balance to sdk ([4647fcf](https://github.com/prometheus-protocol/typescript-sdk/commit/4647fcfe8d4770730bc1a2c502d8805aadc01b9e))

# [1.1.0](https://github.com/prometheus-protocol/typescript-sdk/compare/v1.0.4...v1.1.0) (2025-07-24)


### Features

* add payout method to sdk for paying caller ([cb1aee9](https://github.com/prometheus-protocol/typescript-sdk/commit/cb1aee9e80246423d14617d9c4ec561b4b826803))

## [1.0.4](https://github.com/prometheus-protocol/typescript-sdk/compare/v1.0.3...v1.0.4) (2025-07-23)


### Bug Fixes

* add scope setting and selection to cli ([0f854d7](https://github.com/prometheus-protocol/typescript-sdk/commit/0f854d753079d696326666c216f146b58cb160d1))
* handle encrypted dfx identities ([d2b4f82](https://github.com/prometheus-protocol/typescript-sdk/commit/d2b4f82f270ed80a1ae1519eb8ee5e4b091909d4))

## [1.0.3](https://github.com/prometheus-protocol/typescript-sdk/compare/v1.0.2...v1.0.3) (2025-07-23)


### Bug Fixes

* remove jsonwebtoken from bundle ([feff259](https://github.com/prometheus-protocol/typescript-sdk/commit/feff2592e944ee94084c6b5e8b44f5665e61f535))

## [1.0.2](https://github.com/prometheus-protocol/typescript-sdk/compare/v1.0.1...v1.0.2) (2025-07-23)


### Bug Fixes

* include util polyfill for jws compatibility ([35d94d1](https://github.com/prometheus-protocol/typescript-sdk/commit/35d94d1d704756140816b0061345e416aa464c89))

## [1.0.1](https://github.com/prometheus-protocol/typescript-sdk/compare/v1.0.0...v1.0.1) (2025-07-23)


### Bug Fixes

* add build step to release action ([1a1a8af](https://github.com/prometheus-protocol/typescript-sdk/commit/1a1a8af13aa26e834cdcb19ffd7953f14cfb0b2f))
* remove node prefix to allow use in browser code ([dc1c30f](https://github.com/prometheus-protocol/typescript-sdk/commit/dc1c30f145019e4d40259c47696b1172e5b5a815))
* remove self referential import from browser ([542d228](https://github.com/prometheus-protocol/typescript-sdk/commit/542d22827894532068f46f7d0ed131b6f01fa9af))

# 1.0.0 (2025-07-23)


### Bug Fixes

* add correct permissions to github action ([ba4c6fd](https://github.com/prometheus-protocol/typescript-sdk/commit/ba4c6fd7356cc6c05b51009b062855c2ca8216c5))
* throw correct error to trigger auth flow ([93d2062](https://github.com/prometheus-protocol/typescript-sdk/commit/93d20620d7edb612065648b62893e7ad56cd5c19))
* use node version 20 ([0bba53e](https://github.com/prometheus-protocol/typescript-sdk/commit/0bba53e7ad924e8c1fe055a32671fded0018f96a))


### Features

* create express server and simple spa to demonstrate e2e functionality ([a0fd70b](https://github.com/prometheus-protocol/typescript-sdk/commit/a0fd70b10ae48658b3276c47ed7b2548e2312775))
* demo sentiment analysis server is live and on registry ([fb465f3](https://github.com/prometheus-protocol/typescript-sdk/commit/fb465f3f45e7ab179126e0f9e8e4d16c65b7df65))
* demonstrate token gating express server ([35d7983](https://github.com/prometheus-protocol/typescript-sdk/commit/35d7983d2f0f0436982990e266f543917ba7bf3a))
* mcp server example implementation ([1c65789](https://github.com/prometheus-protocol/typescript-sdk/commit/1c657892042ba245dd96a5df75ba64afe46f7ef3))
* payment flow is complete and successful ([4a2a5d6](https://github.com/prometheus-protocol/typescript-sdk/commit/4a2a5d6c33f846fda7f34665932031d49ad4e6e2))
* removed example pem ([f27c292](https://github.com/prometheus-protocol/typescript-sdk/commit/f27c292f0067178cc29eee2c0dbb235103c4e546))
* repo setup ([efb3b9c](https://github.com/prometheus-protocol/typescript-sdk/commit/efb3b9ce4ae3db0546defcab60891b0cccb69e2b))
* setup sementic release ([e461cf6](https://github.com/prometheus-protocol/typescript-sdk/commit/e461cf64b1438bb30b60ada717665f1a897716e1))
* support registering scopes and accepted payment canisters ([acfc360](https://github.com/prometheus-protocol/typescript-sdk/commit/acfc3608929c82b1fb447bdc759adc5a8750b0d8))
* update readme with instructions and examples ([4e27a36](https://github.com/prometheus-protocol/typescript-sdk/commit/4e27a36170e06563bab9d999f81b31ea52feceda))

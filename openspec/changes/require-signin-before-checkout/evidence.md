# Evidence

Baseline: 502a6a40929d6f0ba5397ae791d82c6bb1d7f042. Independent security review reproduced both direct anonymous purchase paths with mocked SDKs. The existing sole production UI entrypoint already checks current confirmed authentication; no additional auth-wiring gap was found. Independent baseline QA passed 163 focused tests.

The implementation adds purchase-only checks. Root focused regression verification passed 185 tests, including 16 repository cases and six Android/iOS/web page/modal cases added for this change. Existing purchase-only test fixtures now use signed-in customers; anonymous offer and restore fixtures retain their original identity.

Full checks, exports, exact-candidate review, CI and publication are pending. No real purchase, native-device verification, product/price change, new credential or iOS release is claimed. The final PR closure will reconcile this pre-publication snapshot and record exact source, receipts, remaining limits and cleanup without triggering a documentation-only publication loop.

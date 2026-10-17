# Require sign-in before checkout

The Plus screen already requires confirmed account sign-in, but both purchase repositories can still invoke checkout for a resolved anonymous RevenueCat customer when called directly. Enforce the same account requirement at the SDK boundary on native and web.

Success means unresolved or signed-out identities never open billing, queued sign-out/account changes invalidate a purchase, and a matching signed-in customer can still explicitly buy a delivered plan. Signing in or selecting a plan must not charge the customer.

Preserve anonymous plan browsing, existing customer access/restoration, current monthly/yearly catalog, consent, telemetry minimization and native runtime. No new purchase provider, feature, price or UI redesign.

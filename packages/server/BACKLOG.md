
## No in-app password change (2026-08-24)

Upstream has no change-password form — the only path is the reset-email flow,
and the reset page silently redirects to the dashboard if you are still logged
in (EnsureAuthNotAuthenticated guard), so the flow is: log out, then click the
emailed link. Cost Josh three round-trips on day one. Worth adding a proper
"change password" form under Preferences → Users; small, additive.

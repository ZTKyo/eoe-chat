# Privacy Notes

EOE Chat stores conversations and engine diagnostics in the browser's
IndexedDB on the current device. Clearing browser site data deletes that local
history.

When a user sends a message, the necessary conversation context is transmitted
through the server route to the configured AI provider. Provider processing is
subject to that provider's terms and privacy policy.

The application does not intentionally store conversation text in a project
database. Hosting and provider platforms may retain operational metadata or
logs according to their own configuration and policies. Do not enter
information that you are not authorized to send to the configured provider.

Provider credentials and the access password are server-side deployment
secrets. They must never be included in client code, browser storage, source
control, screenshots, or issue reports.

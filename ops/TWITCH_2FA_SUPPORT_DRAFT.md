# Unsent Twitch support draft

No support message has been sent. This draft contains no phone number, email,
verification code, authentication seed or client credential. Do not attach the
owner's original screenshot without redacting its phone field.

Subject: First-time two-factor authentication phone registration rejected

Hello Twitch Support,

I am setting up two-factor authentication for the Twitch account `amirmolotfy`.
On 26 October 2026, Security and Privacy → Set Up Two-Factor Authentication
reached the phone-registration screen, then displayed:

> We weren't able to register two-factor authentication for your phone number.

The selected country is Egypt (+20). The error occurs at registration; I cannot
confirm whether a verification SMS was sent. Developer application registration
also reports that two-factor authentication must be enabled first.

Please advise how to complete the initial phone verification. I can provide any
required account details privately through Twitch's official support process.

## Owner troubleshooting reference

- [Official SMS and 2FA troubleshooting](https://help.twitch.tv/s/article/not-receiving-sms?language=en_US): SMS verification is required before an authenticator app; use a cellular number, wait at least 60 seconds between requests, and contact Twitch Support if the issue persists. If actually rate-limited, the documented wait can be 24 hours. This generic screenshot error does not establish rate limiting as its cause.
- [Official phone-number guide](https://help.twitch.tv/s/article/managing-your-phone-number): separate guidance applies if Twitch explicitly reports that a number is already in use. That specific error has not been observed here.
- Never post phone numbers, codes or authenticator QR images into the repository,
  public game, support draft, recordings or chat. Complete authentication setup
  directly in Twitch's own interface.

ARAGOZ's public rehearsal and code/OBS work can continue independently of this
provider account issue. Real Twitch acceptance remains open until it succeeds.

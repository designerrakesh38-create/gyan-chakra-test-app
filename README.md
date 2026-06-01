# Gyan Chakra Preview

This is a local working preview for the Gyan Chakra quiz idea.

It includes:

- Player registration and login for Bokaro Steel City pincodes.
- Daily quiz questions with server-side answer timing and winner ranking.
- Play with Host qualification questions and shortlist leaderboard.
- Agent/admin panel for publishing questions and reviewing results.

## Local Install

Give someone this whole folder:

```text
can-you-check-my-chatgot-converstation
```

They need Node.js installed. Then they can open the folder in Terminal and run:

```bash
node server.js
```

Then open:

```text
http://localhost:5292
```

## Admin Access

Normal users should open only:

```text
http://localhost:5292
```

Only you should open:

```text
http://localhost:5292/?admin=1
```

Default admin PIN:

```text
1234
```

To use your own PIN, start it like this:

```bash
ADMIN_PIN=your-secret-pin node server.js
```

The admin panel is not linked from the public app, and question editing/reset APIs require the admin PIN.

This is still a local preview. Before production release it still needs real authentication, a hosted database, file uploads, audit logs, privacy policy, anti-cheat controls, and deployment setup.
